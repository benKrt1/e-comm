import mongoose, { Schema, type Model } from 'mongoose';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/categories';

export { PRODUCT_CATEGORIES };
export type { ProductCategory };

export interface ProductImage {
  url: string;
  alt: string;
}

export interface IProduct {
  name: string;
  slug: string;
  description: string;
  brand: string;
  category: ProductCategory;
  price: number;
  images: ProductImage[];
  countInStock: number;
  rating: number;
  numReviews: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductModel = Model<IProduct>;

const imageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true },
    alt: { type: String, required: true, trim: true }, // required: images must be describable for a11y
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      unique: true,
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    // URL identifier derived from the name in the pre-save hook below.
    // Products are addressed by slug (/products/fjell-nighthawk-anc), not raw ObjectId.
    slug: { type: String, unique: true, lowercase: true, index: true },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    brand: { type: String, required: [true, 'Brand is required'], trim: true },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: [...PRODUCT_CATEGORIES], message: 'Unknown category: {VALUE}' },
    },
    // Integer öre (cents) — floats and money don't mix, and Stripe wants integers anyway.
    // 249900 = 2 499,00 kr. Formatting happens client-side with Intl.NumberFormat.
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Price must be an integer amount of öre/cents' },
    },
    images: {
      type: [imageSchema],
      validate: { validator: (arr: ProductImage[]) => arr.length > 0, message: 'At least one image is required' },
    },
    countInStock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0 },
    // Denormalized aggregates, recalculated by the Review model's static after every
    // review write — keeps "sort by rating" a plain indexed query.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false }, // surfaces the product in the homepage hero
  },
  { timestamps: true }
);

// Category filter combined with price sort/range is the catalog's hottest query.
// (Search uses a case-insensitive regex — no text index — because the search
// box sends prefixes like "keyb", which $text cannot match.)
productSchema.index({ category: 1, price: 1 });

// Generate the slug from the name: "Fjell NightHawk ANC" -> "fjell-nighthawk-anc"
productSchema.pre('save', function () {
  if (!this.isModified('name')) return;
  this.slug = this.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
});

const Product = (mongoose.models.Product as ProductModel) ?? mongoose.model<IProduct>('Product', productSchema);

export default Product;
