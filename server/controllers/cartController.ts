import type { Request, Response } from 'express';
import Product from '../models/Product.ts';
import ApiError from '../utils/ApiError.ts';
import type { UserDoc } from '../models/User.ts';

// Fields a cart line needs to render — the full product document
// (description, rating, …) would just bloat every cart response.
const CART_PRODUCT_FIELDS = 'name slug price images countInStock';

/**
 * Populate the user's cart and prune items whose product has been deleted
 * (admin removals must not leave dead references that break rendering).
 * Returns the populated cart array ready for the response envelope.
 */
const populatedCart = async (user: UserDoc) => {
  await user.populate({ path: 'cart.product', select: CART_PRODUCT_FIELDS });
  const live = user.cart.filter((item) => item.product !== null);
  if (live.length !== user.cart.length) {
    user.cart = live;
    await user.save();
  }
  return user.cart;
};

// GET /api/v1/cart
export const getCart = async (req: Request, res: Response) => {
  const cart = await populatedCart(req.user!);
  res.json({ success: true, message: 'Cart fetched', data: { cart } });
};

// POST /api/v1/cart  { productId, quantity }
export const addToCart = async (req: Request, res: Response) => {
  const { productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.countInStock === 0) throw new ApiError(400, 'That product is out of stock');

  const user = req.user!;
  const existing = user.cart.find((item) => item.product.equals(productId));
  const requested = (existing?.quantity ?? 0) + quantity;
  // Clamp instead of rejecting: "add 3 more" with 2 left should put 2 in
  // the cart, not error out. The 99 mirrors the per-line max the validators
  // enforce — repeated adds must not accumulate past it.
  const clamped = Math.min(requested, product.countInStock, 99);

  if (existing) existing.quantity = clamped;
  else user.cart.push({ product: product._id, quantity: clamped });

  await user.save();
  const cart = await populatedCart(user);
  res.status(201).json({ success: true, message: `${product.name} added to your cart`, data: { cart } });
};

// PUT /api/v1/cart/:productId  { quantity }
export const updateCartItem = async (req: Request, res: Response) => {
  const productId = String(req.params.productId);
  const { quantity } = req.body;

  const user = req.user!;
  const item = user.cart.find((i) => i.product.equals(productId));
  if (!item) throw new ApiError(404, 'That product is not in your cart');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');
  if (product.countInStock === 0) throw new ApiError(400, 'That product is out of stock');

  item.quantity = Math.min(quantity, product.countInStock);
  await user.save();
  const cart = await populatedCart(user);
  res.json({ success: true, message: 'Cart updated', data: { cart } });
};

// DELETE /api/v1/cart/:productId
export const removeFromCart = async (req: Request, res: Response) => {
  const productId = String(req.params.productId);

  const user = req.user!;
  const before = user.cart.length;
  user.cart = user.cart.filter((i) => !i.product.equals(productId));
  if (user.cart.length === before) throw new ApiError(404, 'That product is not in your cart');

  await user.save();
  const cart = await populatedCart(user);
  res.json({ success: true, message: 'Removed from your cart', data: { cart } });
};

// DELETE /api/v1/cart
export const clearCart = async (req: Request, res: Response) => {
  req.user!.cart = [];
  await req.user!.save();
  res.json({ success: true, message: 'Cart cleared', data: { cart: [] } });
};

// POST /api/v1/cart/merge  { items: [{ product, quantity }] }
// Called once right after login: folds the guest's localStorage cart into
// the account cart. Quantities add together, clamped to stock; unknown or
// out-of-stock products are silently dropped (stale guest data must never
// break the login flow).
export const mergeCart = async (req: Request, res: Response) => {
  const { items } = req.body as { items: { product: string; quantity: number }[] };

  const user = req.user!;
  for (const guestItem of items) {
    const product = await Product.findById(guestItem.product);
    if (!product || product.countInStock === 0) continue;

    const existing = user.cart.find((i) => i.product.equals(product._id));
    const total = (existing?.quantity ?? 0) + guestItem.quantity;
    const clamped = Math.min(total, product.countInStock);

    if (existing) existing.quantity = clamped;
    else user.cart.push({ product: product._id, quantity: clamped });
  }

  await user.save();
  const cart = await populatedCart(user);
  res.json({ success: true, message: 'Cart merged', data: { cart } });
};
