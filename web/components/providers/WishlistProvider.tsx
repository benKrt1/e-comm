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
import { getWishlistAction, toggleWishlistAction } from '@/actions/wishlist';
import type { SerializedProduct } from '@/types';

/**
 * Account-only wishlist (no guest flavor — spec decision). Holds the
 * populated product list; membership checks derive from it. Every mutation
 * adopts the server action's returned list, like CartProvider does.
 */
interface WishlistState {
  items: SerializedProduct[];
  status: 'loading' | 'ready';
}

type WishlistAction = { type: 'SET_ITEMS'; payload: SerializedProduct[] };

function wishlistReducer(state: WishlistState, action: WishlistAction): WishlistState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.payload, status: 'ready' };
    default:
      return state;
  }
}

interface WishlistContextValue {
  items: SerializedProduct[];
  status: 'loading' | 'ready';
  count: number;
  has: (productId: string) => boolean;
  toggle: (product: { _id: string }) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ isAuthed, children }: { isAuthed: boolean; children: ReactNode }) {
  const addToast = useToast();
  const [state, dispatch] = useReducer(wishlistReducer, { items: [], status: 'loading' });

  useEffect(() => {
    if (!isAuthed) {
      dispatch({ type: 'SET_ITEMS', payload: [] });
      return undefined;
    }
    let cancelled = false;
    getWishlistAction()
      .then((result) => !cancelled && dispatch({ type: 'SET_ITEMS', payload: result.success ? result.wishlist : [] }))
      .catch(() => !cancelled && dispatch({ type: 'SET_ITEMS', payload: [] }));
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  /** Toggle membership. Nudges guests to log in instead of mutating. */
  const toggle = useCallback<WishlistContextValue['toggle']>(
    async (product) => {
      if (!isAuthed) {
        addToast('Log in to save favorites', 'error');
        return;
      }
      const result = await toggleWishlistAction(product._id);
      if (!result.success) throw new Error(result.message);
      dispatch({ type: 'SET_ITEMS', payload: result.wishlist });
    },
    [isAuthed, addToast]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      items: state.items,
      status: state.status,
      count: state.items.length,
      has: (productId: string) => state.items.some((item) => item._id === productId),
      toggle,
    }),
    [state, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}
