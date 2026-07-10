'use server';

import dbConnect from '@/lib/db';
import Product, { type IProduct } from '@/models/Product';
import { requireUser, SessionError } from '@/lib/session';
import { serializeProduct } from '@/lib/data/products';
import { objectIdSchema } from '@/lib/validation/cart';
import type { SerializedProduct } from '@/types';
import type { HydratedDocument, Types } from 'mongoose';
import type { IUser, UserMethods } from '@/models/User';

export interface WishlistActionResult {
  success: boolean;
  message: string;
  wishlist: SerializedProduct[];
}

// Everything a ProductCard renders — the wishlist page reuses the card grid.
const WISHLIST_PRODUCT_FIELDS = 'name slug price images countInStock rating numReviews brand isFeatured description createdAt';

type UserDoc = HydratedDocument<IUser, UserMethods>;

/**
 * Populate the wishlist and prune ids whose product has been deleted,
 * mirroring the cart's self-healing behavior.
 */
async function populatedWishlist(user: UserDoc): Promise<SerializedProduct[]> {
  await user.populate({ path: 'wishlist', select: WISHLIST_PRODUCT_FIELDS });
  const live = user.wishlist.filter((product) => product !== null);
  if (live.length !== user.wishlist.length) {
    user.wishlist = live as Types.ObjectId[];
    await user.save();
  }
  return (user.wishlist as unknown as (IProduct & { _id: Types.ObjectId })[]).map(serializeProduct);
}

function failure(err: unknown): WishlistActionResult {
  const message = err instanceof SessionError ? err.message : 'Could not update your wishlist — please try again';
  return { success: false, message, wishlist: [] };
}

export async function getWishlistAction(): Promise<WishlistActionResult> {
  try {
    const user = await requireUser();
    return { success: true, message: 'Wishlist fetched', wishlist: await populatedWishlist(user) };
  } catch (err) {
    return failure(err);
  }
}

/** Toggle membership. Idempotent add / no-op remove, like the old endpoints. */
export async function toggleWishlistAction(productId: string): Promise<WishlistActionResult> {
  try {
    const id = objectIdSchema.parse(productId);
    const user = await requireUser();
    await dbConnect();

    const saved = user.wishlist.some((wid) => wid.equals(id));
    if (saved) {
      user.wishlist = user.wishlist.filter((wid) => !wid.equals(id));
      await user.save();
      return { success: true, message: 'Removed from your wishlist', wishlist: await populatedWishlist(user) };
    }

    const product = await Product.findById(id);
    if (!product) return { success: false, message: 'Product not found', wishlist: await populatedWishlist(user) };

    user.wishlist.push(product._id);
    await user.save();
    return {
      success: true,
      message: `${product.name} saved to your wishlist`,
      wishlist: await populatedWishlist(user),
    };
  } catch (err) {
    return failure(err);
  }
}
