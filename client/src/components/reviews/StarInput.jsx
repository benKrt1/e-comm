import { useState } from 'react';
import styles from './StarInput.module.css';

/**
 * 1–5 star picker as a real radio group: arrow keys + labels work like
 * native radios; the visual is the classic hover-fill star row.
 */
export default function StarInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className={styles.group} onMouseLeave={() => setHovered(0)}>
      <legend className={styles.legend}>Your rating</legend>
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          className={`${styles.star} ${star <= shown ? styles.filled : ''}`.trim()}
          onMouseEnter={() => setHovered(star)}
        >
          <input
            type="radio"
            name="rating"
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className={styles.input}
          />
          <span aria-hidden="true">★</span>
          <span className={styles.srOnly}>
            {star} {star === 1 ? 'star' : 'stars'}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
