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
import api from '@/lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

type AuthStatus = 'loading' | 'authenticated' | 'guest';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
}

type Action = { type: 'SET_USER'; payload: AuthUser } | { type: 'SET_GUEST' };

/**
 * Auth state machine: 'loading' (restoring session on first mount)
 * → 'authenticated' | 'guest'. Route guards wait out 'loading' so a
 * hard refresh on a protected page doesn't bounce logged-in users.
 */
const initialState: AuthState = { user: null, status: 'loading' };

function authReducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { user: action.payload, status: 'authenticated' };
    case 'SET_GUEST':
      return { user: null, status: 'guest' };
    default:
      return state;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<{ message: string }>;
  register: (name: string, email: string, password: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    dispatch({ type: 'SET_USER', payload: data.data.user });
    return data as { message: string };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    dispatch({ type: 'SET_USER', payload: data.data.user });
    return data as { message: string };
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    dispatch({ type: 'SET_GUEST' });
  }, []);

  const value = useMemo<AuthContextValue>(
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
