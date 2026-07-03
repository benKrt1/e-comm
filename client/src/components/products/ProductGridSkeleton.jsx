import Skeleton from '../ui/Skeleton';
import gridStyles from './ProductGrid.module.css';
import styles from './ProductGridSkeleton.module.css';

/** Placeholder grid shown while the catalog loads — mirrors the card layout. */
export default function ProductGridSkeleton({ count = 8 }) {
  return (
    <ul className={gridStyles.grid} aria-label="Loading products" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.card}>
          <Skeleton className={styles.image} />
          <div className={styles.body}>
            <Skeleton style={{ width: '40%', height: 12 }} />
            <Skeleton style={{ width: '80%', height: 18 }} />
            <Skeleton style={{ width: '55%', height: 14 }} />
            <Skeleton style={{ width: '35%', height: 20 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
