import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './HomePage.module.css';

/**
 * Landing hero. The featured-products section arrives with the catalog
 * in Phase 3 — until then this stays a focused brand statement.
 */
export default function HomePage() {
  const reduceMotion = useReducedMotion();

  const fadeUp = (delay) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: 'easeOut', delay },
  });

  return (
    <main className={styles.hero}>
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
        <Link to="/register" className={styles.cta}>
          Create an account
        </Link>
      </motion.div>
    </main>
  );
}
