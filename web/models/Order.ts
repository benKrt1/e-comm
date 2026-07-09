import mongoose, { Schema, Types, type Model } from 'mongoose';

export interface OrderItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export type OrderStatus = 'pending' | 'shipped' | 'delivered';

export const ORDER_STATUSES = ['pending', 'shipped', 'delivered'] as const;

export interface IOrder {
  user: Types.ObjectId;
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentResult: {
    paymentIntentId: string;
    status?: string;
  };
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: Date;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderModel = Model<IOrder>;

// Items are *snapshots* (name/price/image copied at purchase) so order
// history stays accurate when products are renamed, repriced, or deleted.
const orderItemSchema = new Schema<OrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Price must be an integer amount of öre/cents' },
    },
    image: { type: String, default: '' },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
  },
  { _id: false }
);

const shippingAddressSchema = new Schema<ShippingAddress>(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true },
    street: { type: String, required: [true, 'Street is required'], trim: true },
    postalCode: { type: String, required: [true, 'Postal code is required'], trim: true },
    city: { type: String, required: [true, 'City is required'], trim: true },
    country: { type: String, required: [true, 'Country is required'], trim: true },
  },
  { _id: false }
);

const intOre = (label: string) => ({
  type: Number,
  required: true,
  min: 0,
  validate: { validator: Number.isInteger, message: `${label} must be an integer amount of öre/cents` },
});

const orderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderItems: {
      type: [orderItemSchema],
      validate: { validator: (arr: OrderItem[]) => arr.length > 0, message: 'An order needs at least one item' },
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentResult: {
      // Unique: one order per Stripe payment, ever — the idempotency anchor
      // that makes a double-submitted "place order" safe.
      paymentIntentId: { type: String, required: true, unique: true },
      status: { type: String },
    },
    itemsPrice: intOre('itemsPrice'),
    shippingPrice: intOre('shippingPrice'),
    taxPrice: intOre('taxPrice'), // VAT portion *included* in itemsPrice — informational
    totalPrice: intOre('totalPrice'),
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
    },
  },
  { timestamps: true }
);

const Order = (mongoose.models.Order as OrderModel) ?? mongoose.model<IOrder>('Order', orderSchema);

export default Order;
