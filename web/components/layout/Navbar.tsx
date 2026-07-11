'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/components/providers/CartProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { getErrorMessage } from '@/lib/api';
import styles from './Navbar.module.css';

/**
 * Global navigation. Auth-aware: guests see Login/Sign up, logged-in users
 * see their name (→ profile) and Logout. Cart badge pops on every change.
 */
export default function Navbar() {
  const { user, status, logout } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggle } = useTheme();
  const addToast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const activeClass = (href: string) => (pathname === href ? styles.active : undefined);

  const handleLogout = async () => {
    // Navigate first: if we clear the session while still on a protected
    // page, the guard redirects to /login before we can go home.
    router.push('/');
    try {
      await logout();
      addToast('Logged out — see you soon');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <header className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand}>
          Nord<span className={styles.accent}>Cart</span>
        </Link>

        <div className={styles.links}>
          <Link href="/products" className={activeClass('/products')}>
            Shop
          </Link>
          <Link
            href="/cart"
            className={`${styles.cartLink} ${pathname === '/cart' ? styles.active : ''}`.trim()}
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <AnimatePresence>
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  className={styles.badge}
                  initial={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 500, damping: 25 }}
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <button
            type="button"
            className={styles.themeBtn}
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>

          {status === 'authenticated' && user ? (
            <>
              {user.role === 'admin' && (
                <Link href="/admin" className={activeClass('/admin')}>
                  Admin
                </Link>
              )}
              <Link href="/profile" className={activeClass('/profile')}>
                {user.name.split(' ')[0]}
              </Link>
              <button className={styles.logout} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={activeClass('/login')}>
                Login
              </Link>
              <Link href="/register" className={styles.cta}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
