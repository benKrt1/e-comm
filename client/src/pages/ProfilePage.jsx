import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import usePageTitle from '../hooks/usePageTitle';
import styles from './ProfilePage.module.css';

/** Simple account overview — lives behind ProtectedRoute. */
export default function ProfilePage() {
  usePageTitle('Profile');
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  return (
    <div className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="profile-title">
        <span className={styles.avatar} aria-hidden="true">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <h1 id="profile-title" className={styles.name}>
          {user.name}
        </h1>
        <p className={styles.email}>{user.email}</p>
        {user.role === 'admin' && <span className={styles.badge}>Admin</span>}

        <dl className={styles.stats}>
          <div>
            <dt>Cart items</dt>
            <dd>{itemCount}</dd>
          </div>
          <div>
            <dt>Wishlist</dt>
            <dd>{wishlistCount}</dd>
          </div>
        </dl>
        <div className={styles.links}>
          <Link to="/orders" className={styles.ordersLink}>
            Order history →
          </Link>
          <Link to="/wishlist" className={styles.ordersLink}>
            Wishlist →
          </Link>
        </div>
      </section>
    </div>
  );
}
