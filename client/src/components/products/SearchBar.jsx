import styles from './SearchBar.module.css';

/** Catalog search box. Debouncing lives in CatalogPage; this stays dumb. */
export default function SearchBar({ value, onChange }) {
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
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
