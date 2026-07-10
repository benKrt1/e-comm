'use server';

import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { requireUser, SessionError } from '@/lib/session';
import { objectIdSchema, quantitySchema, mergeItemsSchema } from '@/lib/validation/cart';
import type { CartItemLine, CartProduct } from '@/types';
import type { HydratedDocument } from 'mongoose';
import type { IUser, UserMethods } from '@/models/User';

export interface CartActionResult {
  success: boolean;
  message: string;
  cart: CartItemLine[];
}

// Fields a cart line needs to render — see CartProduct.
const CART_PRODUCT_FIELDS = 'name slug price images countInStock';

type UserDoc = HydratedDocument<IUser, UserMethods>;

/**
 * Populate the user's cart, prune items whose product has been deleted
 * (admin removals must not leave dead references that break rendering),
 * and serialize for the client.
 */
async function populatedCart(user: UserDoc): Promise<CartItemLine[]> {
  await user.populate({ path: 'cart.product', select: CART_PRODUCT_FIELDS });
  const live = user.cart.filter((item) => item.product !== null);
  if (live.length !== user.cart.length) {
    user.cart = live;
    await user.save();
  }

  return user.cart.map((item) => {
    // Populated documents lose their compile-time type — narrow by hand.
    const p = item.product as unknown as CartProduct & { _id: { toString(): string } };
    return {
      product: {
        _id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        price: p.price,
        images: p.images.map(({ url, alt }) => ({ url, alt })),
        countInStock: p.countInStock,
      },
      quantity: item.quantity,
    };
  });
}

/** Uniform failure envelope; session problems get their message through. */
function failure(err: unknown): CartActionResult {
  const message =
    err instanceof SessionError ? err.message : 'Could not update your cart — please try again';
  return { success: false, message, cart: [] };
}

export async function getCartAction(): Promise<CartActionResult> {
  try {
    const user = await requireUser();
    return { success: true, message: 'Cart fetched', cart: await populatedCart(user) };
  } catch (err) {
    return failure(err);
  }
}

export async function addToCartAction(productId: string, quantity: number): Promise<CartActionResult> {
  try {
    const id = objectIdSchema.parse(productId);
    const qty = quantitySchema.parse(quantity);
    const user = await requireUser();

    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return { success: false, message: 'Product not found', cart: await populatedCart(user) };
    if (product.countInStock === 0)
      return { success: false, message: 'That product is out of stock', cart: await populatedCart(user) };

    const existing = user.cart.find((item) => item.product.equals(id));
    const requested = (existing?.quantity ?? 0) + qty;
    // Clamp instead of rejecting: "add 3 more" with 2 left should put 2 in
    // the cart, not error out. The 99 mirrors the per-line max the validators
    // enforce — repeated adds must not accumulate past it.
    const clamped = Math.min(requested, product.countInStock, 99);

    if (existing) existing.quantity = clamped;
    else user.cart.push({ product: product._id, quantity: clamped });

    await user.save();
    return {
      success: true,
      message: `${product.name} added to your cart`,
      cart: await populatedCart(user),
    };
  } catch (err) {
    return failure(err);
  }
}

export async function updateCartItemAction(productId: string, quantity: number): Promise<CartActionResult> {
  try {
    const id = objectIdSchema.parse(productId);
    const qty = quantitySchema.parse(quantity);
    const user = await requireUser();

    const item = user.cart.find((i) => i.product.equals(id));
    if (!item)
      return { success: false, message: 'That product is not in your cart', cart: await populatedCart(user) };

    await dbConnect();
    const product = await Product.findById(id);
    if (!product) return { success: false, message: 'Product not found', cart: await populatedCart(user) };
    if (product.countInStock === 0)
      return { success: false, message: 'That product is out of stock', cart: await populatedCart(user) };

    item.quantity = Math.min(qty, product.countInStock);
    await user.save();
    return { success: true, message: 'Cart updated', cart: await populatedCart(user) };
  } catch (err) {
    return failure(err);
  }
}

export async function removeFromCartAction(productId: string): Promise<CartActionResult> {
  try {
    const id = objectIdSchema.parse(productId);
    const user = await requireUser();

    const before = user.cart.length;
    user.cart = user.cart.filter((i) => !i.product.equals(id));
    if (user.cart.length === before)
      return { success: false, message: 'That product is not in your cart', cart: await populatedCart(user) };

    await user.save();
    return { success: true, message: 'Removed from your cart', cart: await populatedCart(user) };
  } catch (err) {
    return failure(err);
  }
}

export async function clearCartAction(): Promise<CartActionResult> {
  try {
    const user = await requireUser();
    user.cart = [];
    await user.save();
    return { success: true, message: 'Cart cleared', cart: [] };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Called once right after login: folds the guest's localStorage cart into
 * the account cart. Quantities add together, clamped to stock; unknown or
 * out-of-stock products are silently dropped (stale guest data must never
 * break the login flow).
 */
export async function mergeCartAction(
  items: { product: string; quantity: number }[]
): Promise<CartActionResult> {
  try {
    const parsed = mergeItemsSchema.parse(items);
    const user = await requireUser();
    await dbConnect();

    for (const guestItem of parsed) {
      const product = await Product.findById(guestItem.product);
      if (!product || product.countInStock === 0) continue;

      const existing = user.cart.find((i) => i.product.equals(product._id));
      const total = (existing?.quantity ?? 0) + guestItem.quantity;
      const clamped = Math.min(total, product.countInStock);

      if (existing) existing.quantity = clamped;
      else user.cart.push({ product: product._id, quantity: clamped });
    }

    await user.save();
    return { success: true, message: 'Cart merged', cart: await populatedCart(user) };
  } catch (err) {
    return failure(err);
  }
}
