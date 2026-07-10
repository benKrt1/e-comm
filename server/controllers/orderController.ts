import mongoose from 'mongoose';
import Stripe from 'stripe';
import type { Request, Response } from 'express';
import Order from '../models/Order.ts';
import Product from '../models/Product.ts';
import ApiError from '../utils/ApiError.ts';
import getStripe from '../config/stripe.ts';
import type { UserDoc } from '../models/User.ts';

// --- Pricing rules (single authority — the client only ever displays) ---
// Prices are VAT-inclusive integer öre.
const SHIPPING_FLAT = 4900; // 49 kr
const FREE_SHIPPING_THRESHOLD = 100000; // free at 1 000 kr
const INCLUDED_VAT_FACTOR = 0.2; // 25% VAT included ⇒ VAT part = price × 0.25/1.25

interface PopulatedCartItem {
  product: { _id: mongoose.Types.ObjectId; name: string; price: number; images: { url: string }[]; countInStock: number };
  quantity: number;
}

const priceCart = (cart: PopulatedCartItem[]) => {
  const itemsPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingPrice = itemsPrice >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const taxPrice = Math.round(itemsPrice * INCLUDED_VAT_FACTOR);
  return { itemsPrice, shippingPrice, taxPrice, totalPrice: itemsPrice + shippingPrice };
};

/**
 * Load the user's cart with live product data and reject anything that can
 * no longer be bought. GET /cart deliberately doesn't re-clamp, so checkout
 * is where stale carts meet reality.
 */
const loadCheckoutCart = async (user: UserDoc): Promise<PopulatedCartItem[]> => {
  await user.populate('cart.product');
  if (user.cart.length === 0) throw new ApiError(400, 'Your cart is empty');

  const cart = user.cart as unknown as { product: PopulatedCartItem['product'] | null; quantity: number }[];

  const gone = cart.some((item) => item.product === null);
  if (gone) throw new ApiError(409, 'Some items in your cart are no longer available — please review your cart');

  const short = cart.find((item) => item.quantity > item.product!.countInStock);
  if (short) {
    throw new ApiError(409, `Not enough stock of ${short.product!.name} — only ${short.product!.countInStock} left`);
  }

  return cart as PopulatedCartItem[];
};

// POST /api/v1/orders/payment-intent — price the cart server-side and open a payment
export const createPaymentIntent = async (req: Request, res: Response) => {
  const cart = await loadCheckoutCart(req.user!);
  const totals = priceCart(cart);

  const intent = await getStripe().paymentIntents.create({
    amount: totals.totalPrice,
    currency: 'sek',
    // allow_redirects 'never': redirect-based methods (Klarna & co) would
    // demand a return_url on every confirm — this checkout is on-page only.
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    // Ties the intent to this user so /orders can verify ownership.
    metadata: { userId: req.user!._id.toString() },
  });

  res.json({
    success: true,
    message: 'Payment intent created',
    data: { clientSecret: intent.client_secret, totals },
  });
};

// POST /api/v1/orders  { paymentIntentId, shippingAddress }
export const createOrder = async (req: Request, res: Response) => {
  const { paymentIntentId, shippingAddress } = req.body;
  const user = req.user!;

  // Idempotency: a retried/double-submitted request returns the order the
  // first attempt created instead of failing or double-ordering.
  const existing = await Order.findOne({ 'paymentResult.paymentIntentId': paymentIntentId });
  if (existing) {
    if (!existing.user.equals(user._id)) throw new ApiError(404, 'Payment not found');
    return res.json({ success: true, message: 'Order already placed', data: { order: existing } });
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    // A malformed/foreign id is the caller's problem; anything else (network,
    // Stripe outage) is retryable infrastructure trouble — say so honestly.
    if (err instanceof Stripe.errors.StripeInvalidRequestError) throw new ApiError(404, 'Payment not found');
    console.error('✖ Stripe error:', err instanceof Error ? err.message : err);
    throw new ApiError(502, 'Payment provider is unreachable — please try again');
  }
  if (intent.metadata.userId !== user._id.toString()) throw new ApiError(404, 'Payment not found');
  if (intent.status !== 'succeeded') throw new ApiError(400, 'Payment has not completed');

  const cart = await loadCheckoutCart(user);
  const totals = priceCart(cart);
  // The user paid intent.amount. If the cart changed since (another tab),
  // the amounts diverge — refuse rather than ship a mismatched order.
  if (intent.amount !== totals.totalPrice) {
    throw new ApiError(409, 'Your cart changed after payment — please contact support');
  }

  const orderItems = cart.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    price: item.product.price,
    image: item.product.images[0]?.url ?? '',
    quantity: item.quantity,
  }));

  // Order + stock decrement + cart clear must land together: a partial
  // failure would leave a paid order with unclaimed stock or a still-full
  // cart, and the idempotent retry path above would never finish the job.
  let order;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      [order] = await Order.create(
        [
          {
            user: user._id,
            orderItems,
            shippingAddress,
            paymentResult: { paymentIntentId, status: intent.status },
            ...totals,
            isPaid: true,
            paidAt: new Date(),
          },
        ],
        { session }
      );

      // Sequential on purpose: a session must not run operations in parallel.
      for (const item of orderItems) {
        await Product.updateOne(
          { _id: item.product },
          [{ $set: { countInStock: { $max: [0, { $subtract: ['$countInStock', item.quantity] }] } } }],
          // updatePipeline: Mongoose 9 requires opting in to aggregation-
          // pipeline updates (which this is, to floor the stock at 0).
          { session, updatePipeline: true }
        );
      }

      user.cart = [];
      await user.save({ session });
    });
  } catch (err: any) {
    // Two requests raced past the findOne above — the unique index decides.
    if (err.code === 11000) {
      const winner = await Order.findOne({ 'paymentResult.paymentIntentId': paymentIntentId });
      return res.json({ success: true, message: 'Order already placed', data: { order: winner } });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  res.status(201).json({ success: true, message: 'Order placed — thank you!', data: { order } });
};

// GET /api/v1/orders/mine — the logged-in user's order history, newest first
export const getMyOrders = async (req: Request, res: Response) => {
  const orders = await Order.find({ user: req.user!._id })
    .sort('-createdAt')
    .select('orderItems totalPrice isPaid status createdAt');
  res.json({ success: true, message: 'Your orders', data: { orders } });
};

// GET /api/v1/orders/:id — owner or admin only
export const getOrderById = async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  // 404 (not 403) for someone else's order: don't confirm it exists.
  if (!order || (!order.user.equals(req.user!._id) && req.user!.role !== 'admin')) {
    throw new ApiError(404, 'Order not found');
  }
  res.json({ success: true, message: 'Order fetched', data: { order } });
};
