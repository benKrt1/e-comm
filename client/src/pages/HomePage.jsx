import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import api from '../api/axios';
import ProductGrid from '../components/products/ProductGrid';
import ProductGridSkeleton from '../components/products/ProductGridSkeleton';
import styles from './HomePage.module.css';

/** Landing page: brand hero + featured products strip. */
export default function HomePage() {
  const reduceMotion = useReducedMotion();
  const [featured, setFeatured] = useState(null); // null = loading

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

  const fadeUp = (delay) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: 'easeOut', delay },
  });

  return (
    <main>
      <section className={styles.hero}>
        <motion.h1 {...fadeUp(0)} className={styles.title}>
          Nordic design.
          <br />
          <span className={styles.accent}>Serious tech.</span>
        </motion.h1>
        <motion.p {...fadeUp(0.12)} className={styles.tagline}>
          Headphones, keyboards and smart-home gear — built with the restraint
          of Scandinavian design and none of the compromise.
        </motion.p>
        <motion.div {...fadeUp(0.24)}>
          <Link to="/products" className={styles.cta}>
            Browse the shop
          </Link>
        </motion.div>
      </section>

      <section className={styles.featured} aria-labelledby="featured-heading">
        <div className={styles.featuredHeader}>
          <h2 id="featured-heading">Featured</h2>
          <Link to="/products" className={styles.allLink}>
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
