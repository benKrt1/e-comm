'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useToast } from './ToastProvider';
import {
  getCartAction,
  addToCartAction,
  updateCartItemAction,
  removeFromCartAction,
  clearCartAction,
  mergeCartAction,
  type CartActionResult,
} from '@/actions/cart';
import { readGuestCart, writeGuestCart, clearGuestCart, toCartProduct } from '@/lib/cartStorage';
import type { CartItemLine, CartProduct } from '@/types';

/**
 * One cart for both worlds. Guests: localStorage snapshots, mutated locally.
 * Logged in: the server cart is the single source of truth — every mutation
 * runs a server action and adopts the populated cart from the result.
 * On login the guest cart is folded in via mergeCartAction, then cleared.
 * Item shape is identical either way: { product: {…}, quantity }.
 *
 * isAuthed comes down from the root layout (server-read session) and flips
 * on router.refresh() after login/logout, driving the merge/reset effect.
 */
interface CartState {
  items: CartItemLine[];
  status: 'loading' | 'ready';
}

type CartAction = { type: 'SET_ITEMS'; payload: CartItemLine[] };

const initialState: CartState = { items: [], status: 'loading' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.payload, status: 'ready' };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItemLine[];
  status: 'loading' | 'ready';
  itemCount: number;
  subtotal: number; // integer öre — format at the display boundary only
  addItem: (product: CartProduct, quantity: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Server-action results throw on failure so callers surface the message. */
function adopt(result: CartActionResult, dispatch: (a: CartAction) => void) {
  if (!result.success) throw new Error(result.message);
  dispatch({ type: 'SET_ITEMS', payload: result.cart });
}

export function CartProvider({ isAuthed, children }: { isAuthed: boolean; children: ReactNode }) {
  const addToast = useToast();
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // (Re)load whenever auth flips: login merges + adopts the server cart;
  // logout falls back to the (now empty) guest cart.
  useEffect(() => {
    if (!isAuthed) {
      dispatch({ type: 'SET_ITEMS', payload: readGuestCart() });
      return undefined;
    }

    let cancelled = false;
    // Claim the guest items *before* firing: this effect can run twice
    // (StrictMode) or be cleaned up mid-flight, and the merge is additive —
    // only a synchronous take prevents the same items merging twice.
    const guestItems = readGuestCart();
    clearGuestCart();

    const request = guestItems.length
      ? mergeCartAction(
          guestItems.map(({ product, quantity }) => ({
            product: product._id,
            quantity: Math.min(quantity, 99), // pre-clamp-era carts may exceed the max
          }))
        )
      : getCartAction();

    request
      .then((result) => {
        if (cancelled) return;
        if (!result.success) throw new Error(result.message);
        dispatch({ type: 'SET_ITEMS', payload: result.cart });
      })
      .catch(() => {
        // Failed — hand the items back for the next attempt and tell the
        // user instead of silently presenting an empty cart.
        writeGuestCart(guestItems);
        if (cancelled) return;
        addToast('Could not load your cart — please refresh to try again', 'error');
        dispatch({ type: 'SET_ITEMS', payload: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthed, addToast]);

  /** Persist a guest mutation and reflect it in state in one move. */
  const commitGuest = useCallback((items: CartItemLine[]) => {
    writeGuestCart(items);
    dispatch({ type: 'SET_ITEMS', payload: items });
  }, []);

  const addItem = useCallback<CartContextValue['addItem']>(
    async (product, quantity) => {
      if (isAuthed) {
        adopt(await addToCartAction(product._id, quantity), dispatch);
        return;
      }
      const items = readGuestCart();
      const existing = items.find((i) => i.product._id === product._id);
      // Same clamping rules as the server: cap at stock (and the max of 99
      // per line) instead of erroring.
      const next = existing
        ? items.map((i) =>
            i.product._id === product._id
              ? { ...i, quantity: Math.min(i.quantity + quantity, product.countInStock, 99) }
              : i
          )
        : [
            ...items,
            { product: toCartProduct(product), quantity: Math.min(quantity, product.countInStock, 99) },
          ];
      commitGuest(next);
    },
    [isAuthed, commitGuest]
  );

  const updateQuantity = useCallback<CartContextValue['updateQuantity']>(
    async (productId, quantity) => {
      if (isAuthed) {
        adopt(await updateCartItemAction(productId, quantity), dispatch);
        return;
      }
      const next = readGuestCart().map((i) =>
        i.product._id === productId
          ? { ...i, quantity: Math.min(quantity, i.product.countInStock, 99) }
          : i
      );
      commitGuest(next);
    },
    [isAuthed, commitGuest]
  );

  const removeItem = useCallback<CartContextValue['removeItem']>(
    async (productId) => {
      if (isAuthed) {
        adopt(await removeFromCartAction(productId), dispatch);
        return;
      }
      commitGuest(readGuestCart().filter((i) => i.product._id !== productId));
    },
    [isAuthed, commitGuest]
  );

  const clearCart = useCallback(async () => {
    if (isAuthed) {
      adopt(await clearCartAction(), dispatch);
      return;
    }
    clearGuestCart();
    dispatch({ type: 'SET_ITEMS', payload: [] });
  }, [isAuthed]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    return {
      items: state.items,
      status: state.status,
      itemCount,
      subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [state, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
