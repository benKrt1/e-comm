import { cache } from 'react';
import dbConnect from '@/lib/db';
import Product, { type IProduct } from '@/models/Product';
import type { SerializedProduct } from '@/types';
import type { Types } from 'mongoose';

/**
 * Server-only catalog reads, called directly from server components — the
 * Next.js replacement for the old GET /api/v1/products* endpoints.
 */

type LeanProduct = IProduct & { _id: Types.ObjectId };

export function serializeProduct(doc: LeanProduct): SerializedProduct {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    brand: doc.brand,
    category: doc.category,
    price: doc.price,
    images: doc.images.map(({ url, alt }) => ({ url, alt })),
    countInStock: doc.countInStock,
    rating: doc.rating,
    numReviews: doc.numReviews,
    isFeatured: doc.isFeatured,
    createdAt: doc.createdAt.toISOString(),
  };
}

// User input must never be interpreted as regex syntax.
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SORT_OPTIONS: Record<string, string> = {
  newest: '-createdAt',
  'price-asc': 'price',
  'price-desc': '-price',
  rating: '-rating -numReviews',
};

export const MAX_PAGE_SIZE = 48;
export const DEFAULT_PAGE_SIZE = 12;

export interface CatalogQuery {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  search?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

/**
 * Translates catalog searchParams into Mongoose query pieces. Kept separate
 * so the shape of the public URL API (?category=, ?search=, ?sort=…) is
 * documented in one place.
 */
const buildProductQuery = (query: CatalogQuery) => {
  const filter: Record<string, unknown> = {};

  if (query.category) filter.category = query.category;

  // Prices arrive in öre (integer), same unit they're stored in.
  if (query.minPrice || query.maxPrice) {
    filter.price = {
      ...(query.minPrice && { $gte: Number(query.minPrice) }),
      ...(query.maxPrice && { $lte: Number(query.maxPrice) }),
    };
  }

  // Case-insensitive contains-match across the fields users search by.
  // Regex over a text index because the search box sends prefixes
  // ("keyb…") which $text cannot match. Fine at catalog scale.
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ name: re }, { brand: re }, { description: re }];
  }

  const sort = SORT_OPTIONS[query.sort ?? ''] ?? SORT_OPTIONS.newest;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Number(query.limit) || DEFAULT_PAGE_SIZE);

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};

export async function getProducts(query: CatalogQuery) {
  await dbConnect();
  const { filter, sort, page, limit, skip } = buildProductQuery(query);

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit).lean<LeanProduct[]>(),
    Product.countDocuments(filter),
  ]);

  return {
    products: products.map(serializeProduct),
    page,
    pages: Math.ceil(total / limit),
    total,
  };
}

// Homepage hero strip.
export async function getFeaturedProducts() {
  await dbConnect();
  const products = await Product.find({ isFeatured: true }).sort('-createdAt').limit(4).lean<LeanProduct[]>();
  return products.map(serializeProduct);
}

// Everything the filter sidebar needs: category counts and the real
// min/max price for the range slider.
export async function getProductMeta() {
  await dbConnect();
  const [meta] = await Product.aggregate([
    {
      $facet: {
        categories: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, name: '$_id', count: 1 } },
        ],
        price: [{ $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }],
      },
    },
  ]);

  return {
    categories: meta.categories as { name: string; count: number }[],
    priceRange: meta.price[0]
      ? { min: meta.price[0].min as number, max: meta.price[0].max as number }
      : { min: 0, max: 0 },
  };
}

// Detail page payload: product + related items (same category, excluding
// the product itself; best-rated first). Returns null on unknown slug.
// cache(): generateMetadata and the page component share one DB round-trip.
export const getProductBySlug = cache(async (slug: string) => {
  await dbConnect();
  const product = await Product.findOne({ slug }).lean<LeanProduct>();
  if (!product) return null;

  const related = await Product.find({ category: product.category, _id: { $ne: product._id } })
    .sort('-rating -numReviews')
    .limit(4)
    .lean<LeanProduct[]>();

  return { product: serializeProduct(product), related: related.map(serializeProduct) };
});
