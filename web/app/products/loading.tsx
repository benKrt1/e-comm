import ProductGridSkeleton from '@/components/products/ProductGridSkeleton';
import styles from './CatalogPage.module.css';

export default function CatalogLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <header className={styles.header}>
        <h1>Shop</h1>
      </header>
      <ProductGridSkeleton />
    </main>
  );
}
