'use client';

import Link from 'next/link';
import { useWishlist } from '@/components/providers/WishlistProvider';
import ProductGrid from '@/components/products/ProductGrid';
import Spinner from '@/components/ui/Spinner';
import styles from './WishlistPage.module.css';

export default function WishlistClient() {
  const { items, status, count } = useWishlist();

  if (status === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (count === 0) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>Your wishlist is empty</h1>
        <p>Tap the heart on any product to save it here.</p>
        <Link href="/products" className={styles.browse}>
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        Your wishlist{' '}
        <span>
          ({count} {count === 1 ? 'item' : 'items'})
        </span>
      </h1>
      {/* Cards carry their own hearts — toggling one off removes it live. */}
      <ProductGrid products={items} />
    </main>
  );
}
