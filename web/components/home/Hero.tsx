'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './HomePage.module.css';

/** Brand hero with the staggered fade-up entrance. */
export default function Hero() {
  const reduceMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: 'easeOut' as const, delay },
  });

  return (
    <section className={styles.hero}>
      <motion.h1 {...fadeUp(0)} className={styles.title}>
        Nordic design.
        <br />
        <span className={styles.accent}>Serious tech.</span>
      </motion.h1>
      <motion.p {...fadeUp(0.12)} className={styles.tagline}>
        Headphones, keyboards and smart-home gear — built with the restraint of Scandinavian design
        and none of the compromise.
      </motion.p>
      <motion.div {...fadeUp(0.24)}>
        <Link href="/products" className={styles.cta}>
          Browse the shop
        </Link>
      </motion.div>
    </section>
  );
}
