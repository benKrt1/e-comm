import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { formatPrice } from '../../utils/format';
import placeholder from '../../assets/placeholder-product.svg';
import styles from './CartItemRow.module.css';

/**
 * One cart line. Works for both cart flavors because guest snapshots and
 * the server's populated cart share the { product, quantity } shape.
 * Exit animation plays when the row is removed (parent AnimatePresence).
 */
export default function CartItemRow({ item, onQuantityChange, onRemove }) {
  const reduceMotion = useReducedMotion();
  const { product, quantity } = item;
  const image = product.images[0];
  const maxed = quantity >= product.countInStock;
  const [busy, setBusy] = useState(false);

  // Serialize this row's mutations: rapid +/− clicks would otherwise race,
  // each sending the same absolute quantity computed from stale props.
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.li
      layout={!reduceMotion}
      initial={false}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, x: -48, height: 0, paddingTop: 0, paddingBottom: 0, marginBottom: 0 }
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={styles.row}
    >
      <Link to={`/products/${product.slug}`} className={styles.thumb}>
        <img
          src={image?.url ?? placeholder}
          alt={image?.alt ?? product.name}
          onError={(e) => (e.currentTarget.src = placeholder)}
        />
      </Link>

      <div className={styles.details}>
        <Link to={`/products/${product.slug}`} className={styles.name}>
          {product.name}
        </Link>
        <p className={styles.unitPrice}>{formatPrice(product.price)}</p>
        {maxed && <p className={styles.maxNote}>Max stock reached</p>}
      </div>

      <div className={styles.quantity} role="group" aria-label={`Quantity of ${product.name}`}>
        <button
          onClick={() => run(() => onQuantityChange(product._id, quantity - 1))}
          disabled={busy || quantity <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span aria-live="polite">{quantity}</span>
        <button
          onClick={() => run(() => onQuantityChange(product._id, quantity + 1))}
          disabled={busy || maxed}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <p className={styles.lineTotal}>{formatPrice(product.price * quantity)}</p>

      <button
        className={styles.remove}
        onClick={() => run(() => onRemove(product._id))}
        disabled={busy}
        aria-label={`Remove ${product.name} from cart`}
      >
        ×
      </button>
    </motion.li>
  );
}
