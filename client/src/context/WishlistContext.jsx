import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

/**
 * Account-only wishlist (no guest flavor — spec decision). Holds the
 * populated product list; membership checks derive from it. Every
 * mutation adopts the server's response, like CartContext does.
 */
const initialState = { items: [], status: 'loading' };

function wishlistReducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.payload, status: 'ready' };
    default:
      return state;
  }
}

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { status: authStatus } = useAuth();
  const addToast = useToast();
  const [state, dispatch] = useReducer(wishlistReducer, initialState);
  const isAuthed = authStatus === 'authenticated';

  useEffect(() => {
    if (authStatus === 'loading') return undefined;

    if (authStatus === 'guest') {
      dispatch({ type: 'SET_ITEMS', payload: [] });
      return undefined;
    }

    let cancelled = false;
    api
      .get('/wishlist')
      .then(({ data }) => !cancelled && dispatch({ type: 'SET_ITEMS', payload: data.data.wishlist }))
      .catch(() => !cancelled && dispatch({ type: 'SET_ITEMS', payload: [] }));
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  /** Toggle membership. Returns quietly for guests (after a nudge toast). */
  const toggle = useCallback(
    async (product) => {
      if (!isAuthed) {
        addToast('Log in to save favorites', 'error');
        return;
      }
      const saved = state.items.some((item) => item._id === product._id);
      const { data } = saved
        ? await api.delete(`/wishlist/${product._id}`)
        : await api.post(`/wishlist/${product._id}`);
      dispatch({ type: 'SET_ITEMS', payload: data.data.wishlist });
    },
    [isAuthed, state.items, addToast]
  );

  const value = useMemo(
    () => ({
      items: state.items,
      status: state.status,
      count: state.items.length,
      has: (productId) => state.items.some((item) => item._id === productId),
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
