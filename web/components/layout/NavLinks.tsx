'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useToast } from '@/components/providers/ToastProvider';
import { useCart } from '@/components/providers/CartProvider';
import { logoutAction } from '@/actions/auth';
import type { UserRole } from '@/types/next-auth';
import styles from './Navbar.module.css';

interface NavLinksProps {
  user: { name: string; role: UserRole } | null;
}

export default function NavLinks({ user }: NavLinksProps) {
  const pathname = usePathname();
  const addToast = useToast();
  const { itemCount } = useCart();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const activeClass = (href: string) => (pathname === href ? styles.active : undefined);

  const handleLogout = async () => {
    // Navigate first: if we clear the session while still on a protected
    // page, the proxy redirects to /login before we can go home.
    router.push('/');
    try {
      const { message } = await logoutAction();
      addToast(message);
    } catch {
      addToast('Could not log out — please try again', 'error');
    }
    // Re-render server components (Navbar) with the cleared session.
    router.refresh();
  };

  return (
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
            // key={itemCount}: re-mounts on every change so the badge pops
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
      {user ? (
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
  );
}
