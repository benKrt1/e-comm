import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';

// Everything a ProductCard renders — the wishlist page reuses the card grid.
const WISHLIST_PRODUCT_FIELDS = 'name slug price images countInStock rating numReviews brand';

/**
 * Populate the wishlist and prune ids whose product has been deleted,
 * mirroring the cart's self-healing behavior.
 */
const populatedWishlist = async (user) => {
  await user.populate({ path: 'wishlist', select: WISHLIST_PRODUCT_FIELDS });
  const live = user.wishlist.filter((product) => product !== null);
  if (live.length !== user.wishlist.length) {
    user.wishlist = live;
    await user.save();
  }
  return user.wishlist;
};

// GET /api/v1/wishlist
export const getWishlist = async (req, res) => {
  const wishlist = await populatedWishlist(req.user);
  res.json({ success: true, message: 'Wishlist fetched', data: { wishlist } });
};

// POST /api/v1/wishlist/:productId — idempotent add
export const addToWishlist = async (req, res) => {
  const { productId } = req.params;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  if (!req.user.wishlist.some((id) => id.equals(productId))) {
    req.user.wishlist.push(productId);
    await req.user.save();
  }

  const wishlist = await populatedWishlist(req.user);
  res.status(201).json({ success: true, message: `${product.name} saved to your wishlist`, data: { wishlist } });
};

// DELETE /api/v1/wishlist/:productId — removing a non-member is a no-op
export const removeFromWishlist = async (req, res) => {
  const { productId } = req.params;

  req.user.wishlist = req.user.wishlist.filter((id) => !id.equals(productId));
  await req.user.save();

  const wishlist = await populatedWishlist(req.user);
  res.json({ success: true, message: 'Removed from your wishlist', data: { wishlist } });
};
