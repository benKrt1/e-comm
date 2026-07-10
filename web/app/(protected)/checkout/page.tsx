import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { loadCheckoutCart, priceCart, CheckoutError } from '@/lib/checkout';
import getStripe from '@/lib/stripe';
import { formatPrice } from '@/lib/format';
import CheckoutForm from './CheckoutForm';
import styles from './CheckoutPage.module.css';

export const metadata: Metadata = { title: 'Checkout' };

/**
 * Checkout is server-driven: this RSC prices the (server-side) cart, opens a
 * Stripe PaymentIntent, and hands the clientSecret + totals to the client
 * form. A cart change after this loads makes the amounts diverge — the
 * placeOrder action's amount-mismatch check is the backstop (same trade-off
 * as the old create-on-mount flow).
 */
export default async function CheckoutPage() {
  const user = await requireUser();

  let cart;
  try {
    cart = await loadCheckoutCart(user);
  } catch (err) {
    if (err instanceof CheckoutError) {
      // Empty or unbuyable cart — send the user back to fix it.
      if (err.message === 'Your cart is empty') redirect('/cart');
      return (
        <main className={`${styles.page} ${styles.error}`}>
          <h1>Checkout unavailable</h1>
          <p>{err.message}</p>
          <Link href="/cart" className={styles.backLink}>
            ← Back to your cart
          </Link>
        </main>
      );
    }
    throw err;
  }

  const totals = priceCart(cart);

  const intent = await getStripe().paymentIntents.create({
    amount: totals.totalPrice,
    currency: 'sek',
    // allow_redirects 'never': redirect-based methods (Klarna & co) would
    // demand a return_url on every confirm — this checkout is on-page only.
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    // Ties the intent to this user so placeOrder can verify ownership.
    metadata: { userId: user._id.toString() },
  });

  const summaryItems = cart.map((item) => ({
    id: item.product._id.toString(),
    name: item.product.name,
    quantity: item.quantity,
    lineTotal: item.product.price * item.quantity,
  }));

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>
      <div className={styles.layout}>
        <CheckoutForm clientSecret={intent.client_secret!} totalPrice={totals.totalPrice} />

        <aside className={styles.summary} aria-label="Order summary">
          <h2>Summary</h2>
          <ul className={styles.items}>
            {summaryItems.map((item) => (
              <li key={item.id}>
                <span className={styles.itemName}>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.lineTotal)}</span>
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
