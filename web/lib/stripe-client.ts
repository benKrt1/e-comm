import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Lazy singleton: loadStripe fetches js.stripe.com the moment it runs —
// deferring the call to first use keeps the Stripe script off every page
// except checkout. The publishable key is public by design (pk_test_…).
let stripePromise: Promise<Stripe | null> | undefined;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');
  }
  return stripePromise;
};
