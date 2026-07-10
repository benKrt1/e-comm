'use client';

import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api, { getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/providers/ToastProvider';
import { formatPrice } from '@/lib/format';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from './CheckoutPage.module.css';

const EMPTY_ADDRESS = { fullName: '', street: '', postalCode: '', city: '', country: 'Sweden' };

/**
 * Inner form — must live inside <Elements> to use the Stripe hooks. Charges
 * the card, then turns the paid intent into an order via POST /orders (which
 * is idempotent on the payment id, so retries after a failed order are safe).
 */
export default function CheckoutForm({
  totalPrice,
  onPlaced,
}: {
  totalPrice: number;
  onPlaced: (orderId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const addToast = useToast();
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [paying, setPaying] = useState(false);

  const setField = (field: keyof typeof EMPTY_ADDRESS) => (e: ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return; // Stripe.js still loading

    setPaying(true);
    // 1. Charge the card. redirect:'if_required' keeps card payments on-page.
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
    // failed order POST — fall through to the (idempotent) order creation.
    if (error && error.payment_intent?.status !== 'succeeded') {
      addToast(error.message ?? 'Payment failed', 'error');
      setPaying(false);
      return;
    }
    const intentId = paymentIntent?.id ?? error!.payment_intent!.id;

    // 2. Turn the paid intent into an order.
    try {
      const { data } = await api.post('/orders', { paymentIntentId: intentId, shippingAddress: address });
      addToast(data.message);
      onPlaced(data.data.order._id);
    } catch (err) {
      // Payment went through but the order failed — retryable (idempotent).
      addToast(getErrorMessage(err), 'error');
      setPaying(false);
    }
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
