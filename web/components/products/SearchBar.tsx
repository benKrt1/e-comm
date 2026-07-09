'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSetParam from './useSetParam';
import useDebounce from '@/lib/useDebounce';
import styles from './SearchBar.module.css';

/**
 * Catalog search box. The input responds instantly; the URL param (and with
 * it the server refetch) updates debounced.
 */
export default function SearchBar() {
  const searchParams = useSearchParams();
  const setParam = useSetParam();
  const committed = searchParams.get('search') ?? '';

  const [value, setValue] = useState(committed);
  const debounced = useDebounce(value);

  useEffect(() => {
    if (debounced !== committed) setParam({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debounced]);

  return (
    <div className={styles.wrap}>
      <svg className={styles.icon} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35"
        />
      </svg>
      <input
        type="search"
        className={styles.input}
        placeholder="Search products…"
        aria-label="Search products"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
