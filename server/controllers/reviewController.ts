import type { Request, Response } from 'express';
import Review from '../models/Review.ts';
import Product from '../models/Product.ts';
import Order from '../models/Order.ts';
import ApiError from '../utils/ApiError.ts';

// GET /api/v1/reviews?product=<id> — public
export const getReviews = async (req: Request, res: Response) => {
  const reviews = await Review.find({ product: req.query.product as string })
    .sort('-createdAt')
    .populate('user', 'name');
  res.json({ success: true, message: 'Reviews fetched', data: { reviews } });
};

// POST /api/v1/reviews  { productId, rating, title, comment }
export const createReview = async (req: Request, res: Response) => {
  const { productId, rating, title, comment } = req.body;
  const user = req.user!;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  // The spec's core rule: only verified purchasers review. "Verified" =
  // a paid order of theirs contains this product.
  const purchased = await Order.exists({
    user: user._id,
    isPaid: true,
    'orderItems.product': productId,
  });
  if (!purchased) throw new ApiError(403, 'Only verified purchasers can review this product');

  let review;
  try {
    review = await Review.create({ user: user._id, product: productId, rating, title, comment });
  } catch (err: any) {
    // Unique {user, product} index — friendlier than the generic 11000 message.
    if (err.code === 11000) throw new ApiError(409, 'You have already reviewed this product');
    throw err;
  }

  await Review.recalcProductRating(productId);
  await review.populate('user', 'name');
  res.status(201).json({ success: true, message: 'Review published — thank you!', data: { review } });
};

// PUT /api/v1/reviews/:id  { rating, title, comment } — owner only
export const updateReview = async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);
  // 404 (not 403) for someone else's review: don't confirm it exists.
  if (!review || !review.user.equals(req.user!._id)) throw new ApiError(404, 'Review not found');

  const { rating, title, comment } = req.body;
  review.set({ rating, title, comment });
  await review.save();

  await Review.recalcProductRating(review.product);
  await review.populate('user', 'name');
  res.json({ success: true, message: 'Review updated', data: { review } });
};

// DELETE /api/v1/reviews/:id — owner or admin
export const deleteReview = async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);
  if (!review || (!review.user.equals(req.user!._id) && req.user!.role !== 'admin')) {
    throw new ApiError(404, 'Review not found');
  }

  await review.deleteOne();
  await Review.recalcProductRating(review.product);
  res.json({ success: true, message: 'Review deleted', data: null });
};
