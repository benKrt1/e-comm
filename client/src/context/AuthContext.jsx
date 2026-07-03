import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';

/**
 * Auth state machine: 'loading' (restoring session on first mount)
 * → 'authenticated' | 'guest'. Route guards wait out 'loading' so a
 * hard refresh on a protected page doesn't bounce logged-in users.
 */
const initialState = { user: null, status: 'loading' };

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { user: action.payload, status: 'authenticated' };
    case 'SET_GUEST':
      return { user: null, status: 'guest' };
    default:
      return state;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Session restore: the httpOnly cookie is invisible to JS, so the only
  // way to know if we're logged in is to ask the server.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/me')
      .then(({ data }) => !cancelled && dispatch({ type: 'SET_USER', payload: data.data.user }))
      .catch(() => !cancelled && dispatch({ type: 'SET_GUEST' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    dispatch({ type: 'SET_USER', payload: data.data.user });
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    dispatch({ type: 'SET_USER', payload: data.data.user });
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    dispatch({ type: 'SET_GUEST' });
  }, []);

  const value = useMemo(
    () => ({ user: state.user, status: state.status, login, register, logout }),
    [state, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
