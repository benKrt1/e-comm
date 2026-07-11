'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'nordcart-theme';

/**
 * Light/dark theme. The actual switch happens by setting data-theme on
 * <html> — globals.css redefines its color tokens per theme, so the whole
 * app re-skins. An inline script in the layout sets the initial theme
 * before first paint (no flash); this provider just reads that value and
 * exposes a toggle that persists the choice.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Source of truth is the saved choice (or the OS preference) — reading
  // localStorage is reliable, whereas the data-theme attribute can be stripped
  // by React during hydration of <html>.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Keep <html data-theme> in sync with state — and re-apply it after
  // hydration in case React removed the attribute the init script had set.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // private mode / storage disabled — the choice just won't persist
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
