'use server';

import { revalidatePath } from 'next/cache';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Order from '@/models/Order';
import Review from '@/models/Review';
import cloudinary from '@/lib/cloudinary';
import { requireAdmin, SessionError } from '@/lib/session';
import { productSchema, orderStatusSchema, type ProductInput } from '@/lib/validation/products';
import { objectIdSchema } from '@/lib/validation/cart';

export interface AdminActionResult {
  success: boolean;
  message: string;
  productId?: string;
}

function fail(err: unknown, fallback: string): AdminActionResult {
  return { success: false, message: err instanceof SessionError ? err.message : fallback };
}

/** Revalidate the storefront surfaces a product write can change. */
function revalidateStorefront() {
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/admin/products');
  revalidatePath('/admin');
}

export async function createProductAction(input: ProductInput): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    await dbConnect();
    const product = await Product.create(parsed.data);
    revalidateStorefront();
    return { success: true, message: `${product.name} created`, productId: product._id.toString() };
  } catch (err) {
    return fail(err, 'Could not create the product — please try again');
  }
}

export async function updateProductAction(id: string, input: ProductInput): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const productId = objectIdSchema.parse(id);
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

    await dbConnect();
    const product = await Product.findById(productId);
    if (!product) return { success: false, message: 'Product not found' };

    // set + save (not findByIdAndUpdate): the slug pre-save hook must see a
    // renamed product, and schema validators must run. isFeatured defaults to
    // its current value so omitting it means "unchanged".
    const { isFeatured = product.isFeatured, ...rest } = parsed.data;
    product.set({ ...rest, isFeatured });
    await product.save();

    revalidateStorefront();
    revalidatePath(`/products/${product.slug}`);
    return { success: true, message: `${product.name} updated`, productId: product._id.toString() };
  } catch (err) {
    return fail(err, 'Could not update the product — please try again');
  }
}

export async function deleteProductAction(id: string): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const productId = objectIdSchema.parse(id);

    await dbConnect();
    const product = await Product.findById(productId);
    if (!product) return { success: false, message: 'Product not found' };

    await product.deleteOne();
    // Orphaned reviews would poison future aggregates; carts/wishlists
    // self-heal on their next populate, so they're left alone.
    await Review.deleteMany({ product: product._id });

    revalidateStorefront();
    return { success: true, message: `${product.name} deleted` };
  } catch (err) {
    return fail(err, 'Could not delete the product — please try again');
  }
}

export async function updateOrderStatusAction(id: string, status: string): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const orderId = objectIdSchema.parse(id);
    const parsedStatus = orderStatusSchema.parse(status);

    await dbConnect();
    const order = await Order.findById(orderId);
    if (!order) return { success: false, message: 'Order not found' };

    order.status = parsedStatus;
    await order.save();

    revalidatePath('/admin/orders');
    revalidatePath(`/orders/${order._id.toString()}`);
    return { success: true, message: `Order marked as ${order.status}` };
  } catch (err) {
    return fail(err, 'Could not update the order — please try again');
  }
}

export interface UploadSignatureResult {
  success: boolean;
  message: string;
  data?: {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
    allowedFormats: string;
  };
}

/**
 * Short-lived signature for a direct browser→Cloudinary upload; file bytes
 * never touch this server. allowedFormats is signed so the signature can't be
 * replayed to push arbitrary file types.
 */
export async function getUploadSignatureAction(): Promise<UploadSignatureResult> {
  try {
    await requireAdmin();
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'nordcart/products';
    const allowedFormats = 'jpg,jpeg,png,webp,avif';
    const signature = cloudinary.utils.api_sign_request(
      { allowed_formats: allowedFormats, folder, timestamp },
      process.env.CLOUDINARY_API_SECRET!
    );

    return {
      success: true,
      message: 'Upload signature issued',
      data: {
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY!,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
        folder,
        allowedFormats,
      },
    };
  } catch (err) {
    return { success: false, message: err instanceof SessionError ? err.message : 'Could not issue an upload signature' };
  }
}
