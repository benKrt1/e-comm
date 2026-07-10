import type { HydratedDocument } from 'mongoose';
import type { IUser, UserMethods } from '@/models/User';
import type { CartProduct } from '@/types';
// Registers the Product model so populate('cart.product') resolves its ref —
// in serverless/per-request module graphs it isn't otherwise guaranteed loaded.
import '@/models/Product';

/** Expected checkout failures (empty cart, stock changes) — safe to show. */
export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutError';
  }
}

// --- Pricing rules (single authority — the client only ever displays) ---
// Prices are VAT-inclusive integer öre.
const SHIPPING_FLAT = 4900; // 49 kr
const FREE_SHIPPING_THRESHOLD = 100000; // free at 1 000 kr
const INCLUDED_VAT_FACTOR = 0.2; // 25% VAT included ⇒ VAT part = price × 0.25/1.25

export interface CheckoutTotals {
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
}

type PopulatedCartItem = { product: CartProduct & { _id: { toString(): string } }; quantity: number };

export const priceCart = (cart: PopulatedCartItem[]): CheckoutTotals => {
  const itemsPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingPrice = itemsPrice >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const taxPrice = Math.round(itemsPrice * INCLUDED_VAT_FACTOR);
  return { itemsPrice, shippingPrice, taxPrice, totalPrice: itemsPrice + shippingPrice };
};

type UserDoc = HydratedDocument<IUser, UserMethods>;

/**
 * Load the user's cart with live product data and reject anything that can
 * no longer be bought. The cart page deliberately doesn't re-clamp, so
 * checkout is where stale carts meet reality.
 */
export const loadCheckoutCart = async (user: UserDoc): Promise<PopulatedCartItem[]> => {
  await user.populate('cart.product');
  if (user.cart.length === 0) throw new CheckoutError('Your cart is empty');

  const cart = user.cart as unknown as { product: PopulatedCartItem['product'] | null; quantity: number }[];

  const gone = cart.some((item) => item.product === null);
  if (gone)
    throw new CheckoutError('Some items in your cart are no longer available — please review your cart');

  const short = cart.find((item) => item.quantity > item.product!.countInStock);
  if (short) {
    throw new CheckoutError(
      `Not enough stock of ${short.product!.name} — only ${short.product!.countInStock} left`
    );
  }

  return cart as PopulatedCartItem[];
};
