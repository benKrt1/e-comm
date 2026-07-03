import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { readGuestCart, writeGuestCart, clearGuestCart, toCartProduct } from '../utils/cartStorage';

/**
 * One cart for both worlds. Guests: localStorage snapshots, mutated locally.
 * Logged in: the server cart is the single source of truth — every mutation
 * round-trips and adopts the populated cart from the response envelope.
 * On login the guest cart is folded in via POST /cart/merge, then cleared.
 * Item shape is identical either way: { product: {…}, quantity }.
 */
const initialState = { items: [], status: 'loading' };

function cartReducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.payload, status: 'ready' };
    default:
      return state;
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { status: authStatus } = useAuth();
  const addToast = useToast();
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const isAuthed = authStatus === 'authenticated';

  // (Re)load whenever auth resolves or flips: login merges + adopts the
  // server cart; logout falls back to the (now empty) guest cart.
  useEffect(() => {
    if (authStatus === 'loading') return undefined;

    if (authStatus === 'guest') {
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
      ? api.post('/cart/merge', {
          items: guestItems.map(({ product, quantity }) => ({
            product: product._id,
            quantity: Math.min(quantity, 99), // pre-clamp-era carts may exceed the API's max
          })),
        })
      : api.get('/cart');

    request
      .then(({ data }) => !cancelled && dispatch({ type: 'SET_ITEMS', payload: data.data.cart }))
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
  }, [authStatus, addToast]);

  /** Persist a guest mutation and reflect it in state in one move. */
  const commitGuest = useCallback((items) => {
    writeGuestCart(items);
    dispatch({ type: 'SET_ITEMS', payload: items });
  }, []);

  const addItem = useCallback(
    async (product, quantity) => {
      if (isAuthed) {
        const { data } = await api.post('/cart', { productId: product._id, quantity });
        dispatch({ type: 'SET_ITEMS', payload: data.data.cart });
        return;
      }
      const items = readGuestCart();
      const existing = items.find((i) => i.product._id === product._id);
      // Same clamping rules as the server: cap at stock (and the API's max
      // of 99 per line) instead of erroring.
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

  const updateQuantity = useCallback(
    async (productId, quantity) => {
      if (isAuthed) {
        const { data } = await api.put(`/cart/${productId}`, { quantity });
        dispatch({ type: 'SET_ITEMS', payload: data.data.cart });
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

  const removeItem = useCallback(
    async (productId) => {
      if (isAuthed) {
        const { data } = await api.delete(`/cart/${productId}`);
        dispatch({ type: 'SET_ITEMS', payload: data.data.cart });
        return;
      }
      commitGuest(readGuestCart().filter((i) => i.product._id !== productId));
    },
    [isAuthed, commitGuest]
  );

  const clearCart = useCallback(async () => {
    if (isAuthed) {
      const { data } = await api.delete('/cart');
      dispatch({ type: 'SET_ITEMS', payload: data.data.cart });
      return;
    }
    clearGuestCart();
    dispatch({ type: 'SET_ITEMS', payload: [] });
  }, [isAuthed]);

  const value = useMemo(() => {
    const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    return {
      items: state.items,
      status: state.status,
      itemCount,
      subtotal, // integer öre — format at the display boundary only
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
