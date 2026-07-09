import styles from './Spinner.module.css';

/** Accessible loading indicator. fullPage centers it in the viewport. */
export default function Spinner({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={fullPage ? styles.fullPage : undefined} role="status" aria-label="Loading">
      <span className={styles.ring} aria-hidden="true" />
    </div>
  );
}
