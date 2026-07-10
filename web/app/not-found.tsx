import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './not-found.module.css';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className={styles.wrapper}>
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1 className={styles.title}>This aisle doesn&apos;t exist</h1>
      <p className={styles.text}>The page you&apos;re looking for was moved, removed, or never stocked.</p>
      <Link href="/" className={styles.link}>
        ← Back to the storefront
      </Link>
    </main>
  );
}
