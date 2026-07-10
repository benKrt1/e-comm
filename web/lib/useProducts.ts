'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import api, { getErrorMessage } from '@/lib/api';
import type { SerializedProduct } from '@/types';

interface ProductsResult {
  products: SerializedProduct[];
  page: number;
  pages: number;
  total: number;
  error: string | null;
}

const EMPTY: ProductsResult = { products: [], page: 1, pages: 1, total: 0, error: null };

/**
 * Fetches the catalog for the given filter params (plain object mirroring
 * the API's query string). Loading is *derived*: the stored result is
 * tagged with the query it answered, so any mismatch with the current
 * query means we're loading — no setState-in-effect, no flicker races.
 */
export default function useProducts(params: Record<string, string | undefined>) {
  // Serialize once so the effect dependency is a stable primitive.
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null) as [string, string][]
  ).toString();

  const [result, setResult] = useState<ProductsResult & { key: string | null }>({ key: null, ...EMPTY });

  useEffect(() => {
    const controller = new AbortController();

    api
      .get(`/products?${queryString}`, { signal: controller.signal })
      .then(({ data }) => setResult({ key: queryString, ...EMPTY, ...data.data }))
      .catch((err) => {
        if (axios.isCancel(err)) return; // superseded by a newer request
        setResult({ key: queryString, ...EMPTY, error: getErrorMessage(err) });
      });

    return () => controller.abort();
  }, [queryString]);

  const loading = result.key !== queryString;
  return { ...result, loading, error: loading ? null : result.error };
}
