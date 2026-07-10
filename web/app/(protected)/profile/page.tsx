'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/components/providers/CartProvider';
import { useWishlist } from '@/components/providers/WishlistProvider';
import styles from './ProfilePage.module.css';

/** Account overview. Live stats come from the cart/wishlist providers. */
export default function ProfilePage() {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  // ProtectedRoute guarantees an authenticated user before this renders.
  if (!user) return null;

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
          <Link href="/orders" className={styles.ordersLink}>
            Order history →
          </Link>
          <Link href="/wishlist" className={styles.ordersLink}>
            Wishlist →
          </Link>
        </div>
      </section>
    </div>
  );
}
