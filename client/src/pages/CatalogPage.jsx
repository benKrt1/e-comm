import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';
import useProducts from '../hooks/useProducts';
import useDebounce from '../hooks/useDebounce';
import ProductGrid from '../components/products/ProductGrid';
import ProductGridSkeleton from '../components/products/ProductGridSkeleton';
import Filters from '../components/products/Filters';
import SearchBar from '../components/products/SearchBar';
import Pagination from '../components/products/Pagination';
import usePageTitle from '../hooks/usePageTitle';
import styles from './CatalogPage.module.css';

/**
 * Catalog. All filter state lives in the URL (?category=&search=&sort=…)
 * so filtered views survive refresh, back-navigation, and link sharing.
 */
export default function CatalogPage() {
  usePageTitle('Shop');
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta, setMeta] = useState(null);

  const params = {
    category: searchParams.get('category') ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    sort: searchParams.get('sort') ?? 'newest',
    page: searchParams.get('page') ?? '1',
  };

  // Search input responds instantly; the API param updates debounced.
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebounce(searchInput);

  // Merge changes into the URL; any filter change resets pagination.
  const setParam = (patch) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries({ page: '', ...patch })) {
          if (value === '' || value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (debouncedSearch !== (searchParams.get('search') ?? '')) {
      setParam({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debouncedSearch]);

  // Sidebar facts (category counts, price bounds) load once.
  useEffect(() => {
    api.get('/products/meta').then(({ data }) => setMeta(data.data));
  }, []);

  const { products, page, pages, total, loading, error } = useProducts({
    ...params,
    search: debouncedSearch,
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Shop</h1>
        <p className={styles.total}>
          {loading ? '…' : `${total} ${total === 1 ? 'product' : 'products'}`}
        </p>
      </header>

      <div className={styles.toolbar}>
        <SearchBar value={searchInput} onChange={setSearchInput} />
        <label className={styles.sort}>
          <span>Sort by</span>
          <select value={params.sort} onChange={(e) => setParam({ sort: e.target.value })}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Best rated</option>
          </select>
        </label>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Product filters">
          {meta && (
            <Filters
              meta={meta}
              category={params.category}
              minPrice={Number(params.minPrice) || 0}
              maxPrice={Number(params.maxPrice) || 0}
              onCategory={(category) => setParam({ category })}
              onPrice={(minPrice, maxPrice) => setParam({ minPrice, maxPrice })}
            />
          )}
        </aside>

        <section className={styles.results} aria-live="polite">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                <ProductGridSkeleton />
              </motion.div>
            ) : error ? (
              <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.empty}>
                {error}
              </motion.p>
            ) : products.length === 0 ? (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.empty}>
                Nothing matches those filters — try widening the search.
              </motion.p>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                <ProductGrid products={products} />
                <Pagination page={page} pages={pages} onPage={(n) => setParam({ page: String(n) })} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
