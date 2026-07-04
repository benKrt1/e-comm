import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCart } from '../../context/CartContext';
import { getErrorMessage } from '../../api/axios';
import styles from './Navbar.module.css';

/**
 * Global navigation. Auth-aware: guests see Login/Register, logged-in
 * users see their name (→ profile) and Logout.
 */
export default function Navbar() {
  const { user, status, logout } = useAuth();
  const addToast = useToast();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const handleLogout = async () => {
    // Navigate first: if we clear the session while still on a protected
    // page, ProtectedRoute redirects to /login before we can go home.
    navigate('/');
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
        <Link to="/" className={styles.brand}>
          Nord<span className={styles.accent}>Cart</span>
        </Link>

        <div className={styles.links}>
          <NavLink to="/products" className={({ isActive }) => (isActive ? styles.active : undefined)}>
            Shop
          </NavLink>
          <NavLink
            to="/cart"
            className={({ isActive }) => `${styles.cartLink} ${isActive ? styles.active : ''}`.trim()}
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
          </NavLink>
          {status === 'authenticated' ? (
            <>
              {user.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                >
                  Admin
                </NavLink>
              )}
              <NavLink
                to="/profile"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                {user.name.split(' ')[0]}
              </NavLink>
              <button className={styles.logout} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                Login
              </NavLink>
              <NavLink to="/register" className={styles.cta}>
                Sign up
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
