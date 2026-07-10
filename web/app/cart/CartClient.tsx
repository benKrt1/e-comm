'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useCart } from '@/components/providers/CartProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { getErrorMessage } from '@/lib/errors';
import { formatPrice } from '@/lib/format';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import CartItemRow from '@/components/cart/CartItemRow';
import styles from './CartPage.module.css';

export default function CartClient() {
  const { items, status, itemCount, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const addToast = useToast();
  const router = useRouter();

  // Deferred empty state: when the last row is removed, keep the (empty)
  // list mounted until AnimatePresence finishes the exit animation, then
  // swap — otherwise the empty state pops in over the exiting row.
  const hasItems = items.length > 0;
  const [exitDone, setExitDone] = useState(true);
  const [prevHasItems, setPrevHasItems] = useState(hasItems);
  if (prevHasItems !== hasItems) {
    // Render-time adjustment (same pattern as the product gallery reset).
    setPrevHasItems(hasItems);
    if (!hasItems) setExitDone(false);
  }

  // Cart actions throw on failure — surface them, never crash.
  // Returns false on failure so rows know whether to re-enable themselves.
  const safely =
    <A extends unknown[]>(action: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      try {
        await action(...args);
        return true;
      } catch (err) {
        addToast(getErrorMessage(err), 'error');
        return false;
      }
    };

  if (status === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner />
      </main>
    );
  }

  if (!hasItems && exitDone) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>Your cart is empty</h1>
        <p>Find something you like in the shop — it will show up here.</p>
        <Link href="/products" className={styles.browse}>
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        Your cart{' '}
        <span>
          ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </span>
      </h1>

      <div className={styles.layout}>
        <ul className={styles.list}>
          <AnimatePresence initial={false} onExitComplete={() => setExitDone(true)}>
            {items.map((item) => (
              <CartItemRow
                key={item.product._id}
                item={item}
                onQuantityChange={safely(updateQuantity)}
                onRemove={safely(removeItem)}
              />
            ))}
          </AnimatePresence>
        </ul>

        <aside className={styles.summary} aria-label="Order summary">
          <h2>Summary</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Calculated at checkout</dd>
            </div>
          </dl>
          <Button className={styles.checkoutBtn} onClick={() => router.push('/checkout')}>
            Proceed to checkout
          </Button>
          <button className={styles.clear} onClick={() => safely(clearCart)()}>
            Clear cart
          </button>
        </aside>
      </div>
    </main>
  );
}
