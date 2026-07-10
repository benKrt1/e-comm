import type { Types } from 'mongoose';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import Product, { type IProduct } from '@/models/Product';
import User from '@/models/User';
import { serializeProduct } from '@/lib/data/products';
import type { SerializedProduct } from '@/types';

type LeanProduct = IProduct & { _id: Types.ObjectId };

export interface AdminStats {
  revenue: number;
  orderCount: number;
  productCount: number;
  userCount: number;
  lowStock: { _id: string; name: string; slug: string; countInStock: number }[];
  recentOrders: {
    _id: string;
    totalPrice: number;
    status: string;
    createdAt: string;
    userName: string | null;
  }[];
}

// The dashboard's single round-trip.
export async function getAdminStats(): Promise<AdminStats> {
  await dbConnect();
  const [revenueAgg, productCount, userCount, lowStock, recentOrders] = await Promise.all([
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    ]),
    Product.countDocuments(),
    User.countDocuments(),
    Product.find({ countInStock: { $lte: 5 } }).sort('countInStock').limit(8).select('name slug countInStock').lean<LeanProduct[]>(),
    Order.find().sort('-createdAt').limit(5).select('totalPrice status createdAt user').populate('user', 'name').lean(),
  ]);

  return {
    revenue: revenueAgg[0]?.revenue ?? 0, // integer öre, like every price
    orderCount: revenueAgg[0]?.count ?? 0,
    productCount,
    userCount,
    lowStock: lowStock.map((p) => ({
      _id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      countInStock: p.countInStock,
    })),
    recentOrders: (recentOrders as unknown as {
      _id: Types.ObjectId;
      totalPrice: number;
      status: string;
      createdAt: Date;
      user: { name: string } | null;
    }[]).map((o) => ({
      _id: o._id.toString(),
      totalPrice: o.totalPrice,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      userName: o.user?.name ?? null,
    })),
  };
}

export interface AdminOrderRow {
  _id: string;
  itemCount: number;
  totalPrice: number;
  isPaid: boolean;
  status: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

// Every order, newest first.
export async function getAllOrders(): Promise<AdminOrderRow[]> {
  await dbConnect();
  const orders = await Order.find()
    .sort('-createdAt')
    .select('orderItems totalPrice isPaid status createdAt user')
    .populate('user', 'name email')
    .lean();

  return (orders as unknown as {
    _id: Types.ObjectId;
    orderItems: { quantity: number }[];
    totalPrice: number;
    isPaid: boolean;
    status: string;
    createdAt: Date;
    user: { name: string; email: string } | null;
  }[]).map((o) => ({
    _id: o._id.toString(),
    itemCount: o.orderItems.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: o.totalPrice,
    isPaid: o.isPaid,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    userName: o.user?.name ?? null,
    userEmail: o.user?.email ?? null,
  }));
}

// Admin product table — the seed has 24 products, one page covers everything
// (admin-table pagination is out of scope, same trade-off as the old app).
export async function getAdminProducts(): Promise<SerializedProduct[]> {
  await dbConnect();
  const products = await Product.find().sort('-createdAt').limit(48).lean<LeanProduct[]>();
  return products.map(serializeProduct);
}

// The edit form loads by id (the public catalog is slug-only).
export async function getAdminProductById(id: string): Promise<SerializedProduct | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  await dbConnect();
  const product = await Product.findById(id).lean<LeanProduct>();
  return product ? serializeProduct(product) : null;
}
