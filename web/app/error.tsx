'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './not-found.module.css';

/**
 * Root error boundary. Catches unhandled render/server-component errors and
 * offers a retry (re-renders the segment) plus a way home.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.wrapper}>
      <p className={styles.code} aria-hidden="true">
        !
      </p>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.text}>An unexpected error occurred. You can try again or head back to the shop.</p>
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <button className={styles.link} onClick={reset}>
          Try again
        </button>
        <Link href="/" className={styles.link}>
          ← Back to the storefront
        </Link>
      </div>
    </main>
  );
}
