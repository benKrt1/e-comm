import { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api, { getErrorMessage } from '../api/axios';
import { getStripe } from '../utils/stripe';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils/format';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import usePageTitle from '../hooks/usePageTitle';
import styles from './CheckoutPage.module.css';

// Mirrors global.css — Stripe renders the PaymentElement inside an iframe,
// so CSS variables can't reach it; the appearance API is the only way in.
const appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#5eead4',
    colorBackground: '#191c23',
    colorText: '#e8eaf0',
    colorDanger: '#f87171',
    borderRadius: '10px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};

const EMPTY_ADDRESS = { fullName: '', street: '', postalCode: '', city: '', country: 'Sweden' };

/** Inner form — must live inside <Elements> to use the Stripe hooks. */
function CheckoutForm({ totals, onPlaced }) {
  const stripe = useStripe();
  const elements = useElements();
  const addToast = useToast();
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [paying, setPaying] = useState(false);

  const setField = (field) => (e) => setAddress((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return; // Stripe.js still loading

    setPaying(true);
    // 1. Charge the card. redirect:'if_required' keeps card payments on-page.
    // Declines resolve with { error }; a rejected promise means Stripe.js
    // itself failed (network/config) — catch it or the button spins forever.
    let error, paymentIntent;
    try {
      ({ error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      }));
    } catch {
      addToast('Payment could not be started — please try again', 'error');
      setPaying(false);
      return;
    }
    // An "error" whose intent already succeeded means we're retrying after a
    // failed order POST — fall through to the (idempotent) order creation.
    if (error && error.payment_intent?.status !== 'succeeded') {
      addToast(error.message, 'error');
      setPaying(false);
      return;
    }
    const intentId = paymentIntent?.id ?? error.payment_intent.id;

    // 2. Turn the paid intent into an order.
    try {
      const { data } = await api.post('/orders', {
        paymentIntentId: intentId,
        shippingAddress: address,
      });
      onPlaced(data.data.order);
    } catch (err) {
      // Payment went through but the order failed — this is retryable
      // (createOrder is idempotent on the payment id), so tell the user.
      addToast(getErrorMessage(err), 'error');
      setPaying(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <section aria-labelledby="shipping-heading">
        <h2 id="shipping-heading">Shipping address</h2>
        <Input
          id="fullName"
          label="Full name"
          value={address.fullName}
          onChange={setField('fullName')}
          required
          autoComplete="name"
        />
        <Input
          id="street"
          label="Street"
          value={address.street}
          onChange={setField('street')}
          required
          autoComplete="street-address"
        />
        <div className={styles.addressRow}>
          <Input
            id="postalCode"
            label="Postal code"
            value={address.postalCode}
            onChange={setField('postalCode')}
            required
            autoComplete="postal-code"
          />
          <Input
            id="city"
            label="City"
            value={address.city}
            onChange={setField('city')}
            required
            autoComplete="address-level2"
          />
        </div>
        <Input
          id="country"
          label="Country"
          value={address.country}
          onChange={setField('country')}
          required
          autoComplete="country-name"
        />
      </section>

      <section aria-labelledby="payment-heading">
        <h2 id="payment-heading">Payment</h2>
        <PaymentElement />
      </section>

      <Button type="submit" isLoading={paying} disabled={!stripe} className={styles.payButton}>
        Pay {formatPrice(totals.totalPrice)}
      </Button>
      <p className={styles.testHint}>Test mode — use card 4242 4242 4242 4242, any future expiry, any CVC.</p>
    </form>
  );
}

/**
 * Fetches the PaymentIntent and renders the form + summary. Keyed by a
 * signature of the cart contents (see CheckoutPage below) so a cart change
 * mid-checkout remounts this — resetting state via React keys instead of
 * synchronous setState in an effect. Note: only this tab's own cart actions
 * can retrigger the key (CartContext has no cross-tab sync); the server's
 * amount-mismatch 409 is the real backstop for stale carts.
 */
function CheckoutFlow({ items, onPlaced }) {
  const navigate = useNavigate();
  const addToast = useToast();
  const [intent, setIntent] = useState(null); // { clientSecret, totals }
  const [error, setError] = useState(null);

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

  const handlePlaced = (order) => {
    onPlaced();
    addToast('Order placed — thank you!');
    navigate(`/orders/${order._id}`, { replace: true });
  };

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>Checkout unavailable</h1>
        <p>{error}</p>
        <Link to="/cart" className={styles.backLink}>← Back to your cart</Link>
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
        <Elements key={intent.clientSecret} stripe={getStripe()} options={{ clientSecret: intent.clientSecret, appearance }}>
          <CheckoutForm totals={totals} onPlaced={handlePlaced} />
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
  usePageTitle('Checkout');
  const { items, status: cartStatus, clearCart } = useCart();
  // Set before the cart empties on success — stops the guard below from
  // bouncing to /cart in the render between clearCart() and navigation
  // (this page can stay mounted mid page-transition-exit-animation).
  const [placed, setPlaced] = useState(false);

  if (cartStatus === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  // After a successful order we've already navigated away; while this page
  // plays its exit animation, clearCart() empties `items`, which would both
  // remount the flow (cartKey change → doomed intent fetch against an empty
  // cart) and trip the redirect below. Freeze on a spinner instead.
  if (placed) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const handlePlaced = () => {
    setPlaced(true);
    clearCart(); // server already emptied it; this syncs the client state
  };

  // Remount the flow if cart contents change while checking out (only
  // reachable via this tab's own cart actions — CartContext has no cross-tab
  // sync); the fresh intent replaces the stale-amount one, which Stripe just
  // lets expire. The server's amount-mismatch 409 is the real backstop.
  const cartKey = items.map((item) => `${item.product._id}:${item.quantity}`).join('|');

  return <CheckoutFlow key={cartKey} items={items} onPlaced={handlePlaced} />;
}
