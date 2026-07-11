'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Elements } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import api, { getErrorMessage } from '@/lib/api';
import { getStripe } from '@/lib/stripe-client';
import { useCart } from '@/components/providers/CartProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { formatPrice } from '@/lib/format';
import Spinner from '@/components/ui/Spinner';
import CheckoutForm from './CheckoutForm';
import styles from './CheckoutPage.module.css';

// Mirrors globals.css — Stripe renders the PaymentElement inside an iframe,
// so CSS variables can't reach it; the appearance API is the only way in.
// Built per theme so the card form matches light/dark like the rest of the app.
const appearanceFor = (theme: 'light' | 'dark'): StripeElementsOptions['appearance'] =>
  theme === 'dark'
    ? {
        theme: 'night',
        variables: {
          colorPrimary: '#5eead4',
          colorBackground: '#191c23',
          colorText: '#e8eaf0',
          colorDanger: '#f87171',
          borderRadius: '10px',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      }
    : {
        theme: 'stripe',
        variables: {
          colorPrimary: '#0d9488',
          colorBackground: '#ffffff',
          colorText: '#14181f',
          colorDanger: '#dc2626',
          borderRadius: '10px',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      };

interface Totals {
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
}

/**
 * Fetches the PaymentIntent and renders the form + summary. Keyed by a
 * signature of the cart contents (see CheckoutPage below) so a cart change
 * mid-checkout remounts this — resetting state via React keys.
 */
function CheckoutFlow({
  items,
  onPlaced,
}: {
  items: ReturnType<typeof useCart>['items'];
  onPlaced: () => void;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const [intent, setIntent] = useState<{ clientSecret: string; totals: Totals } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .post('/orders/payment-intent')
      .then(({ data }) => !cancelled && setIntent(data.data))
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlaced = (orderId: string) => {
    onPlaced();
    router.replace(`/orders/${orderId}`);
  };

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>Checkout unavailable</h1>
        <p>{error}</p>
        <Link href="/cart" className={styles.backLink}>
          ← Back to your cart
        </Link>
      </main>
    );
  }

  if (!intent) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  const { totals } = intent;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>
      <div className={styles.layout}>
        {/* key: a new clientSecret must remount Elements — it's immutable per instance */}
        <Elements
          key={`${intent.clientSecret}-${theme}`}
          stripe={getStripe()}
          options={{ clientSecret: intent.clientSecret, appearance: appearanceFor(theme) }}
        >
          <CheckoutForm totalPrice={totals.totalPrice} onPlaced={handlePlaced} />
        </Elements>

        <aside className={styles.summary} aria-label="Order summary">
          <h2>Summary</h2>
          <ul className={styles.items}>
            {items.map((item) => (
              <li key={item.product._id}>
                <span className={styles.itemName}>
                  {item.product.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.product.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Items</dt>
              <dd>{formatPrice(totals.itemsPrice)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{totals.shippingPrice === 0 ? 'Free' : formatPrice(totals.shippingPrice)}</dd>
            </div>
            <div>
              <dt>Incl. 25% VAT</dt>
              <dd>{formatPrice(totals.taxPrice)}</dd>
            </div>
            <div className={styles.total}>
              <dt>Total</dt>
              <dd>{formatPrice(totals.totalPrice)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, status: cartStatus, clearCart } = useCart();
  // Set before the cart empties on success — stops the guard below from
  // bouncing to /cart between clearCart() and navigation.
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (cartStatus === 'ready' && items.length === 0 && !placed) {
      router.replace('/cart');
    }
  }, [cartStatus, items.length, placed, router]);

  if (cartStatus === 'loading' || placed || items.length === 0) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  const handlePlaced = () => {
    setPlaced(true);
    clearCart(); // server already emptied it; this syncs the client state
  };

  // Remount the flow if cart contents change while checking out; the fresh
  // intent replaces the stale-amount one. The server's amount-mismatch 409
  // is the real backstop.
  const cartKey = items.map((item) => `${item.product._id}:${item.quantity}`).join('|');

  return <CheckoutFlow key={cartKey} items={items} onPlaced={handlePlaced} />;
}
