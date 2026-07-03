import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../api/axios';

const EMPTY = { products: [], page: 1, pages: 1, total: 0, error: null };

/**
 * Fetches the catalog for the given filter params (plain object mirroring
 * the API's query string). Loading is *derived*: the stored result is
 * tagged with the query it answered, so any mismatch with the current
 * query means we're loading — no setState-in-effect, no flicker races.
 */
export default function useProducts(params) {
  // Serialize once so the effect dependency is a stable primitive.
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  ).toString();

  const [result, setResult] = useState({ key: null, ...EMPTY });

  useEffect(() => {
    const controller = new AbortController();

    api
      .get(`/products?${queryString}`, { signal: controller.signal })
      .then(({ data }) => setResult({ key: queryString, ...EMPTY, ...data.data }))
      .catch((err) => {
        if (err.name === 'CanceledError') return; // superseded by a newer request
        setResult({ key: queryString, ...EMPTY, error: getErrorMessage(err) });
      });

    return () => controller.abort();
  }, [queryString]);

  const loading = result.key !== queryString;
  return { ...result, loading, error: loading ? null : result.error };
}
