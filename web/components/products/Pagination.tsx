'use client';

import useSetParam from './useSetParam';
import styles from './Pagination.module.css';

/** Numbered pagination with prev/next. Hidden when there's a single page. */
export default function Pagination({ page, pages }: { page: number; pages: number }) {
  const setParam = useSetParam();
  if (pages <= 1) return null;

  const goto = (n: number) => setParam({ page: String(n) });

  return (
    <nav className={styles.pagination} aria-label="Catalog pages">
      <button className={styles.btn} disabled={page <= 1} onClick={() => goto(page - 1)} aria-label="Previous page">
        ←
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={`${styles.btn} ${n === page ? styles.active : ''}`}
          onClick={() => goto(n)}
          aria-current={n === page ? 'page' : undefined}
        >
          {n}
        </button>
      ))}
      <button className={styles.btn} disabled={page >= pages} onClick={() => goto(page + 1)} aria-label="Next page">
        →
      </button>
    </nav>
  );
}
