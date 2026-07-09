'use client';

import { useState, type CSSProperties } from 'react';
import useSetParam from './useSetParam';
import { formatPrice } from '@/lib/format';
import type { CatalogMeta } from '@/types';
import styles from './Filters.module.css';

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ');

interface FiltersProps {
  meta: CatalogMeta;
  category: string;
  minPrice: number;
  maxPrice: number;
}

/**
 * Category pills + dual-thumb price range slider.
 * meta comes from getProductMeta(). Slider edits are local state and only
 * commit (→ URL param → server refetch) when the user releases the thumb.
 */
export default function Filters({ meta, category, minPrice, maxPrice }: FiltersProps) {
  const setParam = useSetParam();

  // Slider works in whole kronor; the URL (like the DB) speaks öre.
  const boundMin = Math.floor(meta.priceRange.min / 100);
  const boundMax = Math.ceil(meta.priceRange.max / 100);

  const fromProps = (): [number, number] => [
    minPrice ? Math.floor(minPrice / 100) : boundMin,
    maxPrice ? Math.ceil(maxPrice / 100) : boundMax,
  ];

  const [range, setRange] = useState<[number, number]>(fromProps);

  // Re-sync the local slider whenever the committed URL values change
  // ("adjust state when props change" — render-time, not an effect).
  const [synced, setSynced] = useState({ minPrice, maxPrice, boundMin, boundMax });
  if (
    synced.minPrice !== minPrice ||
    synced.maxPrice !== maxPrice ||
    synced.boundMin !== boundMin ||
    synced.boundMax !== boundMax
  ) {
    setSynced({ minPrice, maxPrice, boundMin, boundMax });
    setRange(fromProps());
  }

  const commit = () => {
    const [lo, hi] = range;
    setParam({
      minPrice: lo > boundMin ? String(lo * 100) : '',
      maxPrice: hi < boundMax ? String(hi * 100) : '',
    });
  };

  const setLo = (v: string) => setRange(([, hi]) => [Math.min(Number(v), hi), hi]);
  const setHi = (v: string) => setRange(([lo]) => [lo, Math.max(Number(v), lo)]);

  const pct = (v: number) => ((v - boundMin) / (boundMax - boundMin)) * 100;

  return (
    <div className={styles.filters}>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Category</legend>
        <ul className={styles.pills}>
          <li>
            <button
              className={`${styles.pill} ${!category ? styles.active : ''}`}
              onClick={() => setParam({ category: '' })}
            >
              All
            </button>
          </li>
          {meta.categories.map((c) => (
            <li key={c.name}>
              <button
                className={`${styles.pill} ${category === c.name ? styles.active : ''}`}
                onClick={() => setParam({ category: c.name })}
              >
                {label(c.name)} <span className={styles.count}>{c.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Price</legend>
        <div
          className={styles.slider}
          style={{ '--lo': `${pct(range[0])}%`, '--hi': `${pct(range[1])}%` } as CSSProperties}
        >
          <input
            type="range"
            min={boundMin}
            max={boundMax}
            step="50"
            value={range[0]}
            aria-label="Minimum price (kr)"
            onChange={(e) => setLo(e.target.value)}
            onPointerUp={commit}
            onKeyUp={commit}
          />
          <input
            type="range"
            min={boundMin}
            max={boundMax}
            step="50"
            value={range[1]}
            aria-label="Maximum price (kr)"
            onChange={(e) => setHi(e.target.value)}
            onPointerUp={commit}
            onKeyUp={commit}
          />
        </div>
        <p className={styles.priceLabel}>
          {formatPrice(range[0] * 100)} — {formatPrice(range[1] * 100)}
        </p>
      </fieldset>
    </div>
  );
}
