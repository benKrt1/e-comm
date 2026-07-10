import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import styles from './ProfilePage.module.css';

export const metadata: Metadata = { title: 'Profile' };

/** Account overview. Stats read live from the user document server-side. */
export default async function ProfilePage() {
  const user = await requireUser();
  const itemCount = user.cart.reduce((sum, item) => sum + item.quantity, 0);
  const wishlistCount = user.wishlist.length;

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
