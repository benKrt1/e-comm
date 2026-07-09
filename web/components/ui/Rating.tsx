import styles from './Rating.module.css';

/**
 * Read-only star rating. Fractional values render as partially filled
 * stars via a clipped overlay (4.5 → four and a half stars).
 */
export default function Rating({ value = 0, count }: { value?: number; count?: number }) {
  return (
    <div className={styles.rating}>
      <span className={styles.stars} role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
        <span className={styles.base} aria-hidden="true">
          ★★★★★
        </span>
        <span className={styles.fill} style={{ width: `${(value / 5) * 100}%` }} aria-hidden="true">
          ★★★★★
        </span>
      </span>
      {count !== undefined && (
        <span className={styles.count}>{count === 0 ? 'No reviews yet' : `(${count})`}</span>
      )}
    </div>
  );
}
