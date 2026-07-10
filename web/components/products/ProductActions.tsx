'use client';

import { useState } from 'react';
import { useCart } from '@/components/providers/CartProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { getErrorMessage } from '@/lib/errors';
import Button from '@/components/ui/Button';
import type { SerializedProduct } from '@/types';
import styles from '@/app/products/[slug]/ProductPage.module.css';

/** Quantity stepper + add-to-cart for the product page. */
export default function ProductActions({ product }: { product: SerializedProduct }) {
  const { addItem } = useCart();
  const addToast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const outOfStock = product.countInStock === 0;

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      await addItem(product, quantity);
      addToast(`${product.name} added to your cart`);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setAdding(false);
    }
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
      <Button disabled={outOfStock} isLoading={adding} onClick={handleAddToCart}>
        {outOfStock ? 'Out of stock' : 'Add to cart'}
      </Button>
    </div>
  );
}
