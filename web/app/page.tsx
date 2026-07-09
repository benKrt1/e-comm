import Link from 'next/link';
import Hero from '@/components/home/Hero';
import ProductGrid from '@/components/products/ProductGrid';
import { getFeaturedProducts } from '@/lib/data/products';
import styles from '@/components/home/HomePage.module.css';

/** Landing page: brand hero + featured products strip. */
export default async function HomePage() {
  // The hero still works without the strip.
  const featured = await getFeaturedProducts().catch(() => []);

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
        {featured.length > 0 && <ProductGrid products={featured} />}
      </section>
    </main>
  );
}
