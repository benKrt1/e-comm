'use client';

import { useSearchParams } from 'next/navigation';
import useSetParam from './useSetParam';
import styles from './SortSelect.module.css';

/** Catalog sort order — state lives in the URL like every other filter. */
export default function SortSelect() {
  const searchParams = useSearchParams();
  const setParam = useSetParam();
  const sort = searchParams.get('sort') ?? 'newest';

  return (
    <label className={styles.sort}>
      <span>Sort by</span>
      <select value={sort} onChange={(e) => setParam({ sort: e.target.value })}>
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="rating">Best rated</option>
      </select>
    </label>
  );
}
