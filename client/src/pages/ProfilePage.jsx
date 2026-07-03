import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ProfilePage.module.css';

/** Simple account overview — lives behind ProtectedRoute. */
export default function ProfilePage() {
  const { user } = useAuth();

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
            <dd>{user.cart.length}</dd>
          </div>
          <div>
            <dt>Wishlist</dt>
            <dd>{user.wishlist.length}</dd>
          </div>
        </dl>
        <Link to="/orders" className={styles.ordersLink}>
          Order history →
        </Link>
      </section>
    </div>
  );
}
