import Stripe from 'stripe';

/**
 * Singleton Stripe client (test mode). Fails loudly at first use if the
 * key is missing or still the .env.example placeholder — a half-configured
 * checkout should error clearly, not create 401s deep inside a request.
 */
let client: Stripe | null = null;

const getStripe = () => {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes('...')) {
      throw new Error('STRIPE_SECRET_KEY is not configured — set a real test key in web/.env.local');
    }
    client = new Stripe(key);
  }
  return client;
};

export default getStripe;
