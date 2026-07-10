import type { Request, Response } from 'express';
import Product from '../models/Product.ts';
import ApiError from '../utils/ApiError.ts';
import { buildProductQuery } from '../utils/queryFeatures.ts';

// GET /api/v1/products — catalog with filter/search/sort/pagination
export const getProducts = async (req: Request, res: Response) => {
  const { filter, sort, page, limit, skip } = buildProductQuery(req.query);

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    message: 'Products fetched',
    data: { products, page, pages: Math.ceil(total / limit), total },
  });
};

// GET /api/v1/products/featured — homepage hero strip
export const getFeaturedProducts = async (_req: Request, res: Response) => {
  const products = await Product.find({ isFeatured: true }).sort('-createdAt').limit(4);
  res.json({ success: true, message: 'Featured products', data: { products } });
};

// GET /api/v1/products/meta — everything the filter sidebar needs:
// category counts and the real min/max price for the range slider.
export const getProductMeta = async (_req: Request, res: Response) => {
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

  res.json({
    success: true,
    message: 'Catalog metadata',
    data: {
      categories: meta.categories,
      priceRange: meta.price[0] ? { min: meta.price[0].min, max: meta.price[0].max } : { min: 0, max: 0 },
    },
  });
};

// GET /api/v1/products/:slug — detail page payload: product + related items
export const getProductBySlug = async (req: Request, res: Response) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) throw new ApiError(404, 'Product not found');

  // Same category, excluding the product itself; best-rated first.
  const related = await Product.find({ category: product.category, _id: { $ne: product._id } })
    .sort('-rating -numReviews')
    .limit(4);

  res.json({ success: true, message: 'Product fetched', data: { product, related } });
};
