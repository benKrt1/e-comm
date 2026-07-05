import { useEffect } from 'react';

const BASE_TITLE = 'NordCart — Nordic Tech & Audio';

/**
 * Per-route document titles (screen readers announce them on navigation;
 * tabs become distinguishable). Falsy titles fall back to the base title,
 * which also comes back on unmount.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · NordCart` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
