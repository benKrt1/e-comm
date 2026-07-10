'use server';

import mongoose from 'mongoose';
import Stripe from 'stripe';
import Order from '@/models/Order';
import Product from '@/models/Product';
import getStripe from '@/lib/stripe';
import { requireUser, SessionError } from '@/lib/session';
import { priceCart, loadCheckoutCart, CheckoutError } from '@/lib/checkout';
import { paymentIntentIdSchema, shippingAddressSchema, type ShippingAddressInput } from '@/lib/validation/orders';

export interface PlaceOrderResult {
  success: boolean;
  message: string;
  orderId?: string;
}

/**
 * Turn a paid PaymentIntent into an order. Ported verbatim from the old
 * POST /api/v1/orders: idempotent on the payment id, transactional stock
 * decrement, cart cleared server-side.
 */
export async function placeOrderAction(
  paymentIntentId: string,
  shippingAddress: ShippingAddressInput
): Promise<PlaceOrderResult> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return { success: false, message: err instanceof SessionError ? err.message : 'Not logged in' };
  }

  const idParsed = paymentIntentIdSchema.safeParse(paymentIntentId);
  if (!idParsed.success) return { success: false, message: idParsed.error.issues[0].message };
  const addressParsed = shippingAddressSchema.safeParse(shippingAddress);
  if (!addressParsed.success) return { success: false, message: addressParsed.error.issues[0].message };
  const intentId = idParsed.data;

  // Idempotency: a retried/double-submitted request returns the order the
  // first attempt created instead of failing or double-ordering.
  const existing = await Order.findOne({ 'paymentResult.paymentIntentId': intentId });
  if (existing) {
    if (!existing.user.equals(user._id)) return { success: false, message: 'Payment not found' };
    return { success: true, message: 'Order already placed', orderId: existing._id.toString() };
  }

  let intent;
  try {
    intent = await getStripe().paymentIntents.retrieve(intentId);
  } catch (err) {
    // A malformed/foreign id is the caller's problem; anything else (network,
    // Stripe outage) is retryable infrastructure trouble — say so honestly.
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return { success: false, message: 'Payment not found' };
    }
    console.error('✖ Stripe error:', err instanceof Error ? err.message : err);
    return { success: false, message: 'Payment provider is unreachable — please try again' };
  }
  if (intent.metadata.userId !== user._id.toString()) return { success: false, message: 'Payment not found' };
  if (intent.status !== 'succeeded') return { success: false, message: 'Payment has not completed' };

  let cart;
  try {
    cart = await loadCheckoutCart(user);
  } catch (err) {
    if (err instanceof CheckoutError) return { success: false, message: err.message };
    throw err;
  }
  const totals = priceCart(cart);
  // The user paid intent.amount. If the cart changed since (another tab),
  // the amounts diverge — refuse rather than ship a mismatched order.
  // (Trade-off: the test-mode payment stays uncaptured-refundable in the
  // dashboard; production would refund automatically or use webhooks.)
  if (intent.amount !== totals.totalPrice) {
    return { success: false, message: 'Your cart changed after payment — please contact support' };
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
  // (VersionError on the cart save aborts the whole transaction → no order
  // → the client's retry starts clean.)
  let orderId = '';
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [order] = await Order.create(
        [
          {
            user: user._id,
            orderItems,
            shippingAddress: addressParsed.data,
            paymentResult: { paymentIntentId: intentId, status: intent.status },
            ...totals,
            isPaid: true,
            paidAt: new Date(),
          },
        ],
        { session }
      );
      orderId = order._id.toString();

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
  } catch (err) {
    // Two requests raced past the findOne above — the unique index decides.
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      const winner = await Order.findOne({ 'paymentResult.paymentIntentId': intentId });
      if (winner) return { success: true, message: 'Order already placed', orderId: winner._id.toString() };
    }
    throw err;
  } finally {
    await session.endSession();
  }

  return { success: true, message: 'Order placed — thank you!', orderId };
}
