import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Rating from '../ui/Rating';
import WishlistButton from '../wishlist/WishlistButton';
import { formatPrice } from '../../utils/format';
import placeholder from '../../assets/placeholder-product.svg';
import styles from './ProductCard.module.css';

// Entrance animation is orchestrated by the parent grid's stagger:
// the container switches hidden→visible and these variants inherit it.
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

export default function ProductCard({ product }) {
  const lowStock = product.countInStock > 0 && product.countInStock <= 5;
  const outOfStock = product.countInStock === 0;

  return (
    <motion.li variants={cardVariants} className={styles.card}>
      <Link to={`/products/${product.slug}`} className={styles.link}>
        <div className={styles.imageWrap}>
          <img
            src={product.images[0].url}
            alt={product.images[0].alt}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = placeholder;
            }}
          />
          {outOfStock && <span className={`${styles.badge} ${styles.out}`}>Out of stock</span>}
          {lowStock && <span className={styles.badge}>Only {product.countInStock} left</span>}
        </div>
        <div className={styles.body}>
          <p className={styles.brand}>{product.brand}</p>
          <h3 className={styles.name}>{product.name}</h3>
          <Rating value={product.rating} count={product.numReviews} />
          <p className={styles.price}>{formatPrice(product.price)}</p>
        </div>
      </Link>
      <WishlistButton product={product} className={styles.wishlist} />
    </motion.li>
  );
}
