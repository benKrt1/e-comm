'use server';

import dbConnect from '@/lib/db';
import Review from '@/models/Review';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { requireUser, SessionError } from '@/lib/session';
import { serializeReview } from '@/lib/data/reviews';
import { reviewInputSchema, objectIdSchema, type ReviewInput } from '@/lib/validation/reviews';
import type { SerializedReview } from '@/types';
import type { Types } from 'mongoose';

export interface ReviewActionResult {
  success: boolean;
  message: string;
  review?: SerializedReview;
}

function failMessage(err: unknown, fallback: string) {
  return err instanceof SessionError ? err.message : fallback;
}

type PopulatedLeanReview = Parameters<typeof serializeReview>[0];

async function loadSerialized(reviewId: Types.ObjectId): Promise<SerializedReview> {
  const populated = await Review.findById(reviewId).populate('user', 'name').lean<PopulatedLeanReview>();
  return serializeReview(populated!);
}

export async function createReviewAction(productId: string, input: ReviewInput): Promise<ReviewActionResult> {
  try {
    const id = objectIdSchema.parse(productId);
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    const user = await requireUser();
    await dbConnect();

    const product = await Product.findById(id);
    if (!product) return { success: false, message: 'Product not found' };

    // The spec's core rule: only verified purchasers review. "Verified" =
    // a paid order of theirs contains this product.
    const purchased = await Order.exists({ user: user._id, isPaid: true, 'orderItems.product': id });
    if (!purchased) return { success: false, message: 'Only verified purchasers can review this product' };

    let review;
    try {
      review = await Review.create({ user: user._id, product: id, ...parsed.data });
    } catch (err) {
      // Unique {user, product} index — friendlier than the generic 11000.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        return { success: false, message: 'You have already reviewed this product' };
      }
      throw err;
    }

    await Review.recalcProductRating(id);
    return { success: true, message: 'Review published — thank you!', review: await loadSerialized(review._id) };
  } catch (err) {
    return { success: false, message: failMessage(err, 'Could not publish your review — please try again') };
  }
}

export async function updateReviewAction(reviewId: string, input: ReviewInput): Promise<ReviewActionResult> {
  try {
    const id = objectIdSchema.parse(reviewId);
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    const user = await requireUser();
    await dbConnect();

    const review = await Review.findById(id);
    // 404-style for someone else's review: don't confirm it exists.
    if (!review || !review.user.equals(user._id)) return { success: false, message: 'Review not found' };

    review.set(parsed.data);
    await review.save();

    await Review.recalcProductRating(review.product);
    return { success: true, message: 'Review updated', review: await loadSerialized(review._id) };
  } catch (err) {
    return { success: false, message: failMessage(err, 'Could not update your review — please try again') };
  }
}

export async function deleteReviewAction(reviewId: string): Promise<ReviewActionResult> {
  try {
    const id = objectIdSchema.parse(reviewId);
    const user = await requireUser();
    await dbConnect();

    const review = await Review.findById(id);
    if (!review || (!review.user.equals(user._id) && user.role !== 'admin')) {
      return { success: false, message: 'Review not found' };
    }

    await review.deleteOne();
    await Review.recalcProductRating(review.product);
    return { success: true, message: 'Review deleted' };
  } catch (err) {
    return { success: false, message: failMessage(err, 'Could not delete your review — please try again') };
  }
}
