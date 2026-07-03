import mongoose from 'mongoose';

// Items are *snapshots* (name/price/image copied at purchase) so order
// history stays accurate when products are renamed, repriced, or deleted.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
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

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true },
    street: { type: String, required: [true, 'Street is required'], trim: true },
    postalCode: { type: String, required: [true, 'Postal code is required'], trim: true },
    city: { type: String, required: [true, 'City is required'], trim: true },
    country: { type: String, required: [true, 'Country is required'], trim: true },
  },
  { _id: false }
);

const intOre = (label) => ({
  type: Number,
  required: true,
  min: 0,
  validate: { validator: Number.isInteger, message: `${label} must be an integer amount of öre/cents` },
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderItems: {
      type: [orderItemSchema],
      validate: { validator: (arr) => arr.length > 0, message: 'An order needs at least one item' },
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
      enum: ['pending', 'shipped', 'delivered'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

export default Order;
