import styles from './Input.module.css';

/**
 * Text input with a floating label (pure CSS: the label sits inside the
 * field and floats up on focus or when the field has content).
 * Errors are wired to the input via aria-describedby/aria-invalid.
 */
export default function Input({ id, label, error = '', type = 'text', ...rest }) {
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      {/* placeholder=" " keeps :placeholder-shown usable for the float logic */}
      <input
        id={id}
        type={type}
        placeholder=" "
        className={`${styles.input} ${error ? styles.hasError : ''}`.trim()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
