import type { Types } from 'mongoose';
import dbConnect from '@/lib/db';
import Review from '@/models/Review';
import type { SerializedReview } from '@/types';

type PopulatedLeanReview = {
  _id: Types.ObjectId;
  user: { _id: Types.ObjectId; name: string };
  product: Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  createdAt: Date;
};

export function serializeReview(doc: PopulatedLeanReview): SerializedReview {
  return {
    _id: doc._id.toString(),
    user: { _id: doc.user._id.toString(), name: doc.user.name },
    product: doc.product.toString(),
    rating: doc.rating,
    title: doc.title,
    comment: doc.comment,
    createdAt: doc.createdAt.toISOString(),
  };
}

// Reviews are public — rendered server-side on the product page.
export async function getProductReviews(productId: string) {
  await dbConnect();
  const reviews = await Review.find({ product: productId })
    .sort('-createdAt')
    .populate('user', 'name')
    .lean<PopulatedLeanReview[]>();

  return reviews.map(serializeReview);
}
