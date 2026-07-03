import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../api/axios';
import styles from './Navbar.module.css';

/**
 * Global navigation. Auth-aware: guests see Login/Register, logged-in
 * users see their name (→ profile) and Logout. The cart icon joins in
 * Phase 4 once the CartContext exists.
 */
export default function Navbar() {
  const { user, status, logout } = useAuth();
  const addToast = useToast();
  const navigate = useNavigate();

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
          {status === 'authenticated' ? (
            <>
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
