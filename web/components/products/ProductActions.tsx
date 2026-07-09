'use client';

import { useState } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import Button from '@/components/ui/Button';
import type { SerializedProduct } from '@/types';
import styles from '@/app/products/[slug]/ProductPage.module.css';

/**
 * Quantity stepper + add-to-cart. The cart itself lands in the next
 * migration phase; until then the button explains itself.
 */
export default function ProductActions({ product }: { product: SerializedProduct }) {
  const addToast = useToast();
  const [quantity, setQuantity] = useState(1);

  const outOfStock = product.countInStock === 0;

  const handleAddToCart = () => {
    addToast('The cart arrives in the next migration phase', 'error');
  };

  return (
    <div className={styles.actions}>
      <div className={styles.quantity} role="group" aria-label="Quantity">
        <button
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={outOfStock || quantity <= 1}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span aria-live="polite">{quantity}</span>
        <button
          onClick={() => setQuantity((q) => Math.min(product.countInStock, q + 1))}
          disabled={outOfStock || quantity >= product.countInStock}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <Button disabled={outOfStock} onClick={handleAddToCart}>
        {outOfStock ? 'Out of stock' : 'Add to cart'}
      </Button>
    </div>
  );
}
