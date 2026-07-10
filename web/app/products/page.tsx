'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import useProducts from '@/lib/useProducts';
import Filters from '@/components/products/Filters';
import SearchBar from '@/components/products/SearchBar';
import SortSelect from '@/components/products/SortSelect';
import Pagination from '@/components/products/Pagination';
import ProductGrid from '@/components/products/ProductGrid';
import ProductGridSkeleton from '@/components/products/ProductGridSkeleton';
import type { CatalogMeta } from '@/types';
import styles from './CatalogPage.module.css';

/**
 * Catalog. All filter state lives in the URL (?category=&search=&sort=…) so
 * filtered views survive refresh, back-navigation, and link sharing. The
 * data is fetched client-side from the Express API.
 */
function CatalogInner() {
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<CatalogMeta | null>(null);

  const params = {
    category: searchParams.get('category') ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    search: searchParams.get('search') ?? '',
    sort: searchParams.get('sort') ?? 'newest',
    page: searchParams.get('page') ?? '1',
  };

  // Sidebar facts (category counts, price bounds) load once.
  useEffect(() => {
    api.get('/products/meta').then(({ data }) => setMeta(data.data)).catch(() => {});
  }, []);

  const { products, page, pages, total, loading, error } = useProducts(params);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Shop</h1>
        <p className={styles.total}>{loading ? '…' : `${total} ${total === 1 ? 'product' : 'products'}`}</p>
      </header>

      <div className={styles.toolbar}>
        <SearchBar />
        <SortSelect />
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Product filters">
          {meta && (
            <Filters
              meta={meta}
              category={params.category}
              minPrice={Number(params.minPrice) || 0}
              maxPrice={Number(params.maxPrice) || 0}
            />
          )}
        </aside>

        <section className={styles.results} aria-live="polite">
          {loading ? (
            <ProductGridSkeleton />
          ) : error ? (
            <p className={styles.empty}>{error}</p>
          ) : products.length === 0 ? (
            <p className={styles.empty}>Nothing matches those filters — try widening the search.</p>
          ) : (
            <>
              <ProductGrid products={products} />
              <Pagination page={page} pages={pages} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function CatalogPage() {
  // useSearchParams requires a Suspense boundary.
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <CatalogInner />
    </Suspense>
  );
}
