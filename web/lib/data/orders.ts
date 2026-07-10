import type { Types } from 'mongoose';
import dbConnect from '@/lib/db';
import Order, { type IOrder } from '@/models/Order';
import type { SerializedOrder } from '@/types';

type LeanOrder = IOrder & { _id: Types.ObjectId };

export function serializeOrder(doc: LeanOrder): SerializedOrder {
  return {
    _id: doc._id.toString(),
    orderItems: doc.orderItems.map((item) => ({
      product: item.product.toString(),
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: item.quantity,
    })),
    shippingAddress: {
      fullName: doc.shippingAddress.fullName,
      street: doc.shippingAddress.street,
      postalCode: doc.shippingAddress.postalCode,
      city: doc.shippingAddress.city,
      country: doc.shippingAddress.country,
    },
    itemsPrice: doc.itemsPrice,
    shippingPrice: doc.shippingPrice,
    taxPrice: doc.taxPrice,
    totalPrice: doc.totalPrice,
    isPaid: doc.isPaid,
    paidAt: doc.paidAt?.toISOString(),
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** The user's order history, newest first — subset a list row renders. */
export async function getMyOrders(userId: string) {
  await dbConnect();
  const orders = await Order.find({ user: userId })
    .sort('-createdAt')
    .lean<LeanOrder[]>();
  return orders.map(serializeOrder);
}

/** Owner or admin only. 404-style null for someone else's order. */
export async function getOrderById(id: string, userId: string, isAdmin: boolean) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  await dbConnect();
  const order = await Order.findById(id).lean<LeanOrder>();
  if (!order || (order.user.toString() !== userId && !isAdmin)) return null;
  return serializeOrder(order);
}
