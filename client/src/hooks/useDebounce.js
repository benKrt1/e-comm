import { useState, useEffect } from 'react';

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 * Used by the catalog search box so we don't fire an API request per keystroke.
 */
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
