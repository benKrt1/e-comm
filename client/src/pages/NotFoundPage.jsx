import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <main className={styles.wrapper}>
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1 className={styles.title}>This aisle doesn&apos;t exist</h1>
      <p className={styles.text}>The page you&apos;re looking for was moved, removed, or never stocked.</p>
      <Link to="/" className={styles.link}>
        ← Back to the storefront
      </Link>
    </main>
  );
}
