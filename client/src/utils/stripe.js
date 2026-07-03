import { loadStripe } from '@stripe/stripe-js';

// Lazy singleton: loadStripe fetches js.stripe.com the moment it runs, and
// this module is statically imported app-wide via CheckoutPage — deferring
// the call to first use keeps the Stripe script off every other page.
// The publishable key is public by design (pk_test_…).
let stripePromise;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};
