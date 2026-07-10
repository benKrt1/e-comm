import type { Request, Response } from 'express';
import Product from '../models/Product.ts';
import Order from '../models/Order.ts';
import User from '../models/User.ts';
import Review from '../models/Review.ts';
import ApiError from '../utils/ApiError.ts';
import cloudinary from '../config/cloudinary.ts';

// GET /api/v1/admin/stats — the dashboard's single round-trip
export const getStats = async (_req: Request, res: Response) => {
  const [revenueAgg, productCount, userCount, lowStock, recentOrders] = await Promise.all([
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    ]),
    Product.countDocuments(),
    User.countDocuments(),
    Product.find({ countInStock: { $lte: 5 } }).sort('countInStock').limit(8).select('name slug countInStock'),
    Order.find().sort('-createdAt').limit(5).select('totalPrice status createdAt user').populate('user', 'name'),
  ]);

  res.json({
    success: true,
    message: 'Dashboard stats',
    data: {
      revenue: revenueAgg[0]?.revenue ?? 0, // integer öre, like every price
      orderCount: revenueAgg[0]?.count ?? 0,
      productCount,
      userCount,
      lowStock,
      recentOrders,
    },
  });
};

// GET /api/v1/admin/products/:id — the edit form loads by id (public API is slug-only)
export const getProductById = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, message: 'Product fetched', data: { product } });
};

// POST /api/v1/admin/products
export const createProduct = async (req: Request, res: Response) => {
  const { name, description, brand, category, price, countInStock, images, isFeatured } = req.body;
  const product = await Product.create({ name, description, brand, category, price, countInStock, images, isFeatured });
  res.status(201).json({ success: true, message: `${product.name} created`, data: { product } });
};

// PUT /api/v1/admin/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  // isFeatured is optional in the API: omitting it must mean "unchanged" —
  // set({ isFeatured: undefined }) would silently UNSET the flag on save.
  const { name, description, brand, category, price, countInStock, images, isFeatured = product.isFeatured } = req.body;
  // set + save (not findByIdAndUpdate): the slug pre-save hook must see a
  // renamed product, and schema validators must run.
  product.set({ name, description, brand, category, price, countInStock, images, isFeatured });
  await product.save();

  res.json({ success: true, message: `${product.name} updated`, data: { product } });
};

// DELETE /api/v1/admin/products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  await product.deleteOne();
  // Orphaned reviews would poison future aggregates; carts/wishlists
  // self-heal on their next populate, so they're left alone.
  await Review.deleteMany({ product: product._id });

  res.json({ success: true, message: `${product.name} deleted`, data: null });
};

// GET /api/v1/admin/orders — every order, newest first
export const getAllOrders = async (_req: Request, res: Response) => {
  const orders = await Order.find()
    .sort('-createdAt')
    .select('orderItems totalPrice isPaid status createdAt user')
    .populate('user', 'name email');
  res.json({ success: true, message: 'All orders', data: { orders } });
};

// PUT /api/v1/admin/orders/:id/status  { status }
export const updateOrderStatus = async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  order.status = req.body.status;
  await order.save();

  res.json({ success: true, message: `Order marked as ${order.status}`, data: { order } });
};

// POST /api/v1/admin/uploads/signature — short-lived signature for a direct
// browser→Cloudinary upload; file bytes never touch this server.
export const getUploadSignature = (_req: Request, res: Response) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'nordcart/products';
  // allowedFormats is signed so the signature can't be replayed to push
  // arbitrary file types — Cloudinary rejects uploads outside this list.
  const allowedFormats = 'jpg,jpeg,png,webp,avif';
  const signature = cloudinary.utils.api_sign_request(
    { allowed_formats: allowedFormats, folder, timestamp },
    process.env.CLOUDINARY_API_SECRET as string
  );

  res.json({
    success: true,
    message: 'Upload signature issued',
    data: {
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
      allowedFormats,
    },
  });
};
