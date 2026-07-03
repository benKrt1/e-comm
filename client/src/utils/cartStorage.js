// Guest cart persistence. The stored shape mirrors the server's *populated*
// cart — [{ product: {…}, quantity }] — so CartPage/Navbar render guest and
// account carts identically, and the merge endpoint only needs product._id.
const KEY = 'nordcart:cart';

export const readGuestCart = () => {
  try {
    const items = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(items) ? items : [];
  } catch {
    return []; // corrupted storage must never crash the app
  }
};

export const writeGuestCart = (items) => {
  if (items.length === 0) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(items));
};

export const clearGuestCart = () => localStorage.removeItem(KEY);

/** Trim a full product down to what a cart line needs before persisting. */
export const toCartProduct = ({ _id, name, slug, price, images, countInStock }) => ({
  _id,
  name,
  slug,
  price,
  images: images.slice(0, 1), // a cart line shows one thumbnail
  countInStock,
});
