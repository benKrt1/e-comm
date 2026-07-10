'use client';

import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { useCart } from '@/components/providers/CartProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { placeOrderAction } from '@/actions/orders';
import { formatPrice } from '@/lib/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from './CheckoutPage.module.css';

// Mirrors globals.css — Stripe renders the PaymentElement inside an iframe,
// so CSS variables can't reach it; the appearance API is the only way in.
const appearance: StripeElementsOptions['appearance'] = {
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
function PaymentForm({ totalPrice }: { totalPrice: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const addToast = useToast();
  const { clearCart } = useCart();
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [paying, setPaying] = useState(false);

  const setField = (field: keyof typeof EMPTY_ADDRESS) => (e: ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return; // Stripe.js still loading

    setPaying(true);
    // 1. Charge the card. redirect:'if_required' keeps card payments on-page.
    // Declines resolve with { error }; a rejected promise means Stripe.js
    // itself failed (network/config) — catch it or the button spins forever.
    let error;
    let paymentIntent;
    try {
      ({ error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' }));
    } catch {
      addToast('Payment could not be started — please try again', 'error');
      setPaying(false);
      return;
    }
    // An "error" whose intent already succeeded means we're retrying after a
    // failed order attempt — fall through to the (idempotent) order creation.
    if (error && error.payment_intent?.status !== 'succeeded') {
      addToast(error.message ?? 'Payment failed', 'error');
      setPaying(false);
      return;
    }
    const intentId = paymentIntent?.id ?? error!.payment_intent!.id;

    // 2. Turn the paid intent into an order (idempotent on the payment id).
    const result = await placeOrderAction(intentId, address);
    if (!result.success || !result.orderId) {
      addToast(result.message, 'error');
      setPaying(false);
      return;
    }

    // Server already emptied the cart — sync client state, then navigate.
    await clearCart().catch(() => {});
    addToast('Order placed — thank you!');
    router.replace(`/orders/${result.orderId}`);
    router.refresh();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <section aria-labelledby="shipping-heading">
        <h2 id="shipping-heading">Shipping address</h2>
        <Input id="fullName" label="Full name" value={address.fullName} onChange={setField('fullName')} required autoComplete="name" />
        <Input id="street" label="Street" value={address.street} onChange={setField('street')} required autoComplete="street-address" />
        <div className={styles.addressRow}>
          <Input id="postalCode" label="Postal code" value={address.postalCode} onChange={setField('postalCode')} required autoComplete="postal-code" />
          <Input id="city" label="City" value={address.city} onChange={setField('city')} required autoComplete="address-level2" />
        </div>
        <Input id="country" label="Country" value={address.country} onChange={setField('country')} required autoComplete="country-name" />
      </section>

      <section aria-labelledby="payment-heading">
        <h2 id="payment-heading">Payment</h2>
        <PaymentElement />
      </section>

      <Button type="submit" isLoading={paying} disabled={!stripe} className={styles.payButton}>
        Pay {formatPrice(totalPrice)}
      </Button>
      <p className={styles.testHint}>Test mode — use card 4242 4242 4242 4242, any future expiry, any CVC.</p>
    </form>
  );
}

export default function CheckoutForm({ clientSecret, totalPrice }: { clientSecret: string; totalPrice: number }) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance }}>
      <PaymentForm totalPrice={totalPrice} />
    </Elements>
  );
}
