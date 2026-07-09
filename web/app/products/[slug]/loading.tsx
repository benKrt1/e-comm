import Skeleton from '@/components/ui/Skeleton';
import styles from './ProductPage.module.css';

export default function ProductLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.layout}>
        <Skeleton className={styles.gallerySkeleton} />
        <div className={styles.infoSkeleton}>
          <Skeleton style={{ width: '30%', height: 14 }} />
          <Skeleton style={{ width: '75%', height: 34 }} />
          <Skeleton style={{ width: '45%', height: 16 }} />
          <Skeleton style={{ width: '100%', height: 90 }} />
          <Skeleton style={{ width: '40%', height: 44 }} />
        </div>
      </div>
    </main>
  );
}
