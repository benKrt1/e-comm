'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useWishlist } from '@/components/providers/WishlistProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { getErrorMessage } from '@/lib/api';
import styles from './WishlistButton.module.css';

/**
 * Heart toggle for a product. Guests get a login nudge (handled inside
 * WishlistProvider.toggle). Never nest this inside a Link/anchor — render
 * it as an absolutely-positioned sibling instead.
 */
export default function WishlistButton({
  product,
  className = '',
}: {
  product: { _id: string; name: string };
  className?: string;
}) {
  const { has, toggle } = useWishlist();
  const addToast = useToast();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const saved = has(product._id);

  const handleToggle = async () => {
    setBusy(true);
    try {
      await toggle(product);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      type="button"
      className={`${styles.heart} ${saved ? styles.saved : ''} ${className}`.trim()}
      onClick={handleToggle}
      disabled={busy}
      whileTap={reduceMotion ? undefined : { scale: 0.85 }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </motion.button>
  );
}
