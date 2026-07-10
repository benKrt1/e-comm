import type { ProductCategory } from '@/models/Product';
import type { OrderStatus } from '@/models/Order';

/**
 * Serialized shapes crossing the RSC/client boundary. Mongoose documents
 * can't be passed to client components, so every data function returns
 * plain objects with stringified ids and ISO dates.
 */

export interface SerializedProduct {
  _id: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  category: ProductCategory;
  price: number; // integer öre
  images: { url: string; alt: string }[];
  countInStock: number;
  rating: number;
  numReviews: number;
  isFeatured: boolean;
  createdAt: string;
}

export interface SerializedReview {
  _id: string;
  user: { _id: string; name: string };
  product: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
}

// Fields a cart line needs to render — the full product document
// (description, rating, …) would just bloat every cart payload.
export interface CartProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: { url: string; alt: string }[];
  countInStock: number;
}

export interface CartItemLine {
  product: CartProduct;
  quantity: number;
}

export interface SerializedOrderItem {
  product: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export interface SerializedOrder {
  _id: string;
  orderItems: SerializedOrderItem[];
  shippingAddress: {
    fullName: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: string;
  status: OrderStatus;
  createdAt: string;
}

export interface CatalogMeta {
  categories: { name: string; count: number }[];
  priceRange: { min: number; max: number };
}
