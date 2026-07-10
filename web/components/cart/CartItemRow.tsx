'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { formatPrice } from '@/lib/format';
import type { CartItemLine } from '@/types';
import styles from './CartItemRow.module.css';

const PLACEHOLDER = '/placeholder-product.svg';

interface CartItemRowProps {
  item: CartItemLine;
  onQuantityChange: (productId: string, quantity: number) => Promise<boolean>;
  onRemove: (productId: string) => Promise<boolean>;
}

/**
 * One cart line. Works for both cart flavors because guest snapshots and
 * the server's populated cart share the { product, quantity } shape.
 * Exit animation plays when the row is removed (parent AnimatePresence).
 */
export default function CartItemRow({ item, onQuantityChange, onRemove }: CartItemRowProps) {
  const reduceMotion = useReducedMotion();
  const { product, quantity } = item;
  const image = product.images[0];
  const maxed = quantity >= product.countInStock;
  const [busy, setBusy] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Serialize this row's mutations: rapid +/− clicks would otherwise race,
  // each sending the same absolute quantity computed from stale props.
  // Handlers resolve to false on failure (CartPage's safely()).
  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  // A successful remove unmounts this row — leaving it disabled prevents
  // ghost clicks during the exit animation. Re-enable only on failure.
  const handleRemove = async () => {
    setBusy(true);
    const ok = await onRemove(product._id);
    if (ok === false) setBusy(false);
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
      <Link href={`/products/${product.slug}`} className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgFailed ? PLACEHOLDER : (image?.url ?? PLACEHOLDER)}
          alt={image?.alt ?? product.name}
          onError={() => setImgFailed(true)}
        />
      </Link>

      <div className={styles.details}>
        <Link href={`/products/${product.slug}`} className={styles.name}>
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
        onClick={handleRemove}
        disabled={busy}
        aria-label={`Remove ${product.name} from cart`}
      >
        ×
      </button>
    </motion.li>
  );
}
