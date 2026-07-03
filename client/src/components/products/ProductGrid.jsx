import { motion, useReducedMotion } from 'framer-motion';
import ProductCard from './ProductCard';
import styles from './ProductGrid.module.css';

/**
 * Responsive card grid with a staggered entrance when scrolled into view.
 * Re-keys on the product list so pagination/filter changes re-animate.
 */
export default function ProductGrid({ products }) {
  const reduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: reduceMotion ? {} : { staggerChildren: 0.07 },
    },
  };

  return (
    <motion.ul
      key={products.map((p) => p._id).join()}
      className={styles.grid}
      variants={containerVariants}
      initial={reduceMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -80px 0px' }}
    >
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </motion.ul>
  );
}
