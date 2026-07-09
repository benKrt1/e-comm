import type { Metadata } from 'next';
import { Suspense } from 'react';
import Filters from '@/components/products/Filters';
import SearchBar from '@/components/products/SearchBar';
import SortSelect from '@/components/products/SortSelect';
import Pagination from '@/components/products/Pagination';
import ProductGrid from '@/components/products/ProductGrid';
import ProductGridSkeleton from '@/components/products/ProductGridSkeleton';
import { getProducts, getProductMeta, type CatalogQuery } from '@/lib/data/products';
import styles from './CatalogPage.module.css';

export const metadata: Metadata = { title: 'Shop' };

/**
 * Catalog. All filter state lives in the URL (?category=&search=&sort=…)
 * so filtered views survive refresh, back-navigation, and link sharing.
 * The results area is its own Suspense boundary keyed on the query, so
 * filter changes swap in the skeleton without unmounting the toolbar
 * (the search input keeps focus while new results stream in).
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogQuery>;
}) {
  const query = await searchParams;
  const meta = await getProductMeta();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Shop</h1>
      </header>

      <div className={styles.toolbar}>
        <SearchBar />
        <SortSelect />
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Product filters">
          <Filters
            meta={meta}
            category={query.category ?? ''}
            minPrice={Number(query.minPrice) || 0}
            maxPrice={Number(query.maxPrice) || 0}
          />
        </aside>

        <section className={styles.results} aria-live="polite">
          <Suspense key={JSON.stringify(query)} fallback={<ProductGridSkeleton />}>
            <CatalogResults query={query} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

async function CatalogResults({ query }: { query: CatalogQuery }) {
  const { products, page, pages, total } = await getProducts(query);

  if (products.length === 0) {
    return <p className={styles.empty}>Nothing matches those filters — try widening the search.</p>;
  }

  return (
    <>
      <p className={styles.total}>
        {total} {total === 1 ? 'product' : 'products'}
      </p>
      <ProductGrid products={products} />
      <Pagination page={page} pages={pages} />
    </>
  );
}
