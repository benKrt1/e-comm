'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Hero from '@/components/home/Hero';
import ProductGrid from '@/components/products/ProductGrid';
import ProductGridSkeleton from '@/components/products/ProductGridSkeleton';
import type { SerializedProduct } from '@/types';
import styles from '@/components/home/HomePage.module.css';

/** Landing page: brand hero + featured products strip. */
export default function HomePage() {
  const [featured, setFeatured] = useState<SerializedProduct[] | null>(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    api
      .get('/products/featured')
      .then(({ data }) => !cancelled && setFeatured(data.data.products))
      .catch(() => !cancelled && setFeatured([])); // hero still works without the strip
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <Hero />

      <section className={styles.featured} aria-labelledby="featured-heading">
        <div className={styles.featuredHeader}>
          <h2 id="featured-heading">Featured</h2>
          <Link href="/products" className={styles.allLink}>
            View all →
          </Link>
        </div>
        {featured === null ? (
          <ProductGridSkeleton count={4} />
        ) : (
          featured.length > 0 && <ProductGrid products={featured} />
        )}
      </section>
    </main>
  );
}
