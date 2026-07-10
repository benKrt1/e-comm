import mongoose, { Schema, Types, type Model } from 'mongoose';

export interface IReview {
  user: Types.ObjectId;
  product: Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewStatics {
  recalcProductRating(productId: Types.ObjectId | string): Promise<void>;
}

export type ReviewModel = Model<IReview> & ReviewStatics;

const reviewSchema = new Schema<IReview, ReviewModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number' },
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

// One review per user per product — the DB-level guarantee behind the
// controller's friendlier 409.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

/**
 * Recalculate the denormalized Product.rating / numReviews after any
 * review write. Keeps "sort by rating" a plain indexed product query.
 * Rounded to one decimal to match what the Rating component displays.
 */
reviewSchema.statics.recalcProductRating = async function (productId: Types.ObjectId | string) {
  const [stats] = await this.aggregate([
    { $match: { product: new Types.ObjectId(productId) } },
    { $group: { _id: null, rating: { $avg: '$rating' }, numReviews: { $sum: 1 } } },
  ]);

  await mongoose.model('Product').updateOne(
    { _id: productId },
    {
      rating: stats ? Math.round(stats.rating * 10) / 10 : 0,
      numReviews: stats?.numReviews ?? 0,
    }
  );
};

const Review = mongoose.model<IReview, ReviewModel>('Review', reviewSchema);

export default Review;
