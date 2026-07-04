# Phase 6 — Reviews + Wishlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Product reviews (verified purchasers only, denormalized rating recalc) and a wishlist (heart toggles + wishlist page) per `docs/specs/2026-07-02-nordcart-design.md` Phase 6.

**Architecture:** Reviews live in their own collection with a compound unique index `{ user, product }`; a model static recalculates the denormalized `Product.rating`/`numReviews` after every write, and the controller enforces verified-purchaser (a paid order containing the product). The wishlist is the existing `user.wishlist` ObjectId array (Phase 1 schema), exposed through its own small router like the cart, and owned client-side by a `WishlistContext` (auth-only — no guest wishlist per spec; guests get a "log in" toast).

**Tech Stack:** Established Phase 2–5 patterns: Express 5 async-throw controllers + ApiError + `{ success, message, data }` envelope, express-validator + `validate`, `protect`; React Context/useReducer, CSS Modules on `global.css` tokens, Framer Motion with `useReducedMotion`.

**Testing & commit conventions:** identical to Phases 4–5 — no test framework (exact curl + browser verification), single phase commit at the end (`Phase 6: …`, NO attribution trailers), push after the phase (standing user request).

**Environment:** API :5001, client :5173 (both may already run via `node --watch`/Vite). Seed users: demo@nordcart.se / Demo1234! (**has 2 paid orders**: "Askr Kontakt Smart Plug Duo" and "Sten Ljusbåge Monitor Lamp" — perfect for verified-purchaser tests), admin@nordcart.se / Admin1234! (**no orders** — perfect for the rejection test). Browser gotcha: occluded window freezes Framer Motion; assert on DOM/URL.

---

## File Structure

**Server:**
- Create: `server/models/Review.js` — schema, unique `{user, product}` index, `recalcProductRating` static.
- Create: `server/controllers/reviewController.js` — list/create/update/delete + purchase check.
- Create: `server/routes/reviewRoutes.js` — GET public, mutations behind `protect`.
- Create: `server/controllers/wishlistController.js` — get/add/remove (populated responses).
- Create: `server/routes/wishlistRoutes.js` — all behind `protect`.
- Modify: `server/app.js` — mount both at the Phase 6 placeholder.

**Client:**
- Create: `client/src/context/WishlistContext.jsx` — ids + populated items, toggle, auth-driven load.
- Modify: `client/src/main.jsx` — `WishlistProvider` inside `AuthProvider` (sibling of CartProvider, inside ToastProvider).
- Create: `client/src/components/wishlist/WishlistButton.jsx` + `.module.css` — heart toggle.
- Modify: `client/src/components/products/ProductCard.jsx` + `.module.css` — heart overlay (sibling of the Link — never nest interactive elements).
- Modify: `client/src/pages/ProductPage.jsx` — heart next to Add-to-cart + `<ReviewsSection>` under the layout.
- Create: `client/src/pages/WishlistPage.jsx` + `.module.css` — grid of saved products, protected `/wishlist`.
- Modify: `client/src/App.jsx` — `/wishlist` route in the ProtectedRoute block.
- Modify: `client/src/pages/ProfilePage.jsx` — "Wishlist →" link next to the existing "Order history →" link.
- Create: `client/src/components/reviews/StarInput.jsx` + `.module.css` — accessible 1–5 star radio group.
- Create: `client/src/components/reviews/ReviewForm.jsx` + `.module.css` — create/edit form.
- Create: `client/src/components/reviews/ReviewsSection.jsx` + `.module.css` — fetch + list + orchestration.

**API contracts decided here:**
- `GET /api/v1/reviews?product=<id>` (public) → `{ data: { reviews } }`, each review `{ _id, user: { _id, name }, product, rating, title, comment, createdAt, updatedAt }`, sorted `-createdAt`.
- `POST /api/v1/reviews` `{ productId, rating, title, comment }` (protect, verified purchaser) → 201 `{ data: { review } }` (populated user). Duplicate → 409.
- `PUT /api/v1/reviews/:id` `{ rating, title, comment }` (protect, owner only) → `{ data: { review } }`.
- `DELETE /api/v1/reviews/:id` (protect, owner or admin) → `{ data: null }`.
- `GET /api/v1/wishlist` (protect) → `{ data: { wishlist } }` — populated products (`name slug price images countInStock rating numReviews brand`).
- `POST /api/v1/wishlist/:productId` / `DELETE /api/v1/wishlist/:productId` (protect) → same populated shape. Add is idempotent (`$addToSet` semantics), remove of a non-member is a no-op success.

---

### Task 1: Review model + API

**Files:**
- Create: `server/models/Review.js`
- Create: `server/controllers/reviewController.js`
- Create: `server/routes/reviewRoutes.js`
- Modify: `server/app.js` (mount)

- [ ] **Step 1: Review model**

Create `server/models/Review.js`:

```js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number' },
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

// One review per user per product — the DB-level guarantee behind the
// controller's friendlier 409.
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

/**
 * Recalculate the denormalized Product.rating / numReviews after any
 * review write. Keeps "sort by rating" a plain indexed product query.
 * Rounded to one decimal to match what the Rating component displays.
 */
reviewSchema.statics.recalcProductRating = async function (productId) {
  const [stats] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, rating: { $avg: '$rating' }, numReviews: { $sum: 1 } } },
  ]);

  await mongoose.model('Product').updateOne(
    { _id: productId },
    {
      rating: stats ? Math.round(stats.rating * 10) / 10 : 0,
      numReviews: stats?.numReviews ?? 0,
    }
  );
};

const Review = mongoose.model('Review', reviewSchema);

export default Review;
```

- [ ] **Step 2: Review controller**

Create `server/controllers/reviewController.js`:

```js
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';

// GET /api/v1/reviews?product=<id> — public
export const getReviews = async (req, res) => {
  const reviews = await Review.find({ product: req.query.product })
    .sort('-createdAt')
    .populate('user', 'name');
  res.json({ success: true, message: 'Reviews fetched', data: { reviews } });
};

// POST /api/v1/reviews  { productId, rating, title, comment }
export const createReview = async (req, res) => {
  const { productId, rating, title, comment } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  // The spec's core rule: only verified purchasers review. "Verified" =
  // a paid order of theirs contains this product.
  const purchased = await Order.exists({
    user: req.user._id,
    isPaid: true,
    'orderItems.product': productId,
  });
  if (!purchased) throw new ApiError(403, 'Only verified purchasers can review this product');

  let review;
  try {
    review = await Review.create({ user: req.user._id, product: productId, rating, title, comment });
  } catch (err) {
    // Unique {user, product} index — friendlier than the generic 11000 message.
    if (err.code === 11000) throw new ApiError(409, 'You have already reviewed this product');
    throw err;
  }

  await Review.recalcProductRating(productId);
  await review.populate('user', 'name');
  res.status(201).json({ success: true, message: 'Review published — thank you!', data: { review } });
};

// PUT /api/v1/reviews/:id  { rating, title, comment } — owner only
export const updateReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  // 404 (not 403) for someone else's review: don't confirm it exists.
  if (!review || !review.user.equals(req.user._id)) throw new ApiError(404, 'Review not found');

  const { rating, title, comment } = req.body;
  review.set({ rating, title, comment });
  await review.save();

  await Review.recalcProductRating(review.product);
  await review.populate('user', 'name');
  res.json({ success: true, message: 'Review updated', data: { review } });
};

// DELETE /api/v1/reviews/:id — owner or admin
export const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review || (!review.user.equals(req.user._id) && req.user.role !== 'admin')) {
    throw new ApiError(404, 'Review not found');
  }

  await review.deleteOne();
  await Review.recalcProductRating(review.product);
  res.json({ success: true, message: 'Review deleted', data: null });
};
```

- [ ] **Step 3: Review routes**

Create `server/routes/reviewRoutes.js`:

```js
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { getReviews, createReview, updateReview, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

const ratingRule = body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt();
const titleRule = body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Title must be between 2 and 100 characters');
const commentRule = body('comment').trim().isLength({ min: 2, max: 1000 }).withMessage('Comment must be between 2 and 1000 characters');
const idParam = param('id').isMongoId().withMessage('Invalid review id');

// Reading reviews is public — everyone sees social proof.
router.get('/', [query('product').isMongoId().withMessage('Invalid product id')], validate, getReviews);

router.post(
  '/',
  protect,
  [body('productId').isMongoId().withMessage('Invalid product id'), ratingRule, titleRule, commentRule],
  validate,
  createReview
);

router.put('/:id', protect, [idParam, ratingRule, titleRule, commentRule], validate, updateReview);
router.delete('/:id', protect, [idParam], validate, deleteReview);

export default router;
```

- [ ] **Step 4: Mount** — in `server/app.js`, add `import reviewRoutes from './routes/reviewRoutes.js';` after orderRoutes and replace the `// app.use('/api/v1/reviews', reviewRoutes);   — Phase 6` placeholder with the real mount after the orders mount (keep the Phase 7 comment line). (The wishlist mount lands in Task 2 — leave room.)

- [ ] **Step 5: Lint** — `npm run lint --prefix server`, exit 0.

- [ ] **Step 6: Verify with curl**

```bash
cd /Users/arbenkurti/Documents/Proggramering/e-commerce
JAR=/tmp/nc6-demo.cookies; AJAR=/tmp/nc6-admin.cookies
API=http://localhost:5001/api/v1
curl -s -c $JAR -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@nordcart.se","password":"Demo1234!"}' > /dev/null
curl -s -c $AJAR -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@nordcart.se","password":"Admin1234!"}' > /dev/null
# demo bought the smart plug (Phase 5 order) — find its id + current rating
PID=$(curl -s "$API/products/askr-kontakt-smart-plug-duo" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.product._id))')
echo "PID=$PID"
# 1. create (expect 201, populated user name "Erik Demo")
curl -s -b $JAR -X POST $API/reviews -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"rating\":5,\"title\":\"Superb plugs\",\"comment\":\"Setup took two minutes, rock solid since.\"}" | head -c 260; echo
# 2. duplicate (expect 409 already reviewed)
curl -s -b $JAR -X POST $API/reviews -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"rating\":4,\"title\":\"Again\",\"comment\":\"Trying to double-review.\"}" | head -c 120; echo
# 3. non-purchaser (admin) rejected (expect 403)
curl -s -b $AJAR -X POST $API/reviews -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"rating\":1,\"title\":\"Nope\",\"comment\":\"Never bought this.\"}" | head -c 120; echo
# 4. guest create rejected (expect 401), guest READ allowed (expect list with 1 review)
curl -s -X POST $API/reviews -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"rating\":5,\"title\":\"x\",\"comment\":\"xx\"}" | head -c 80; echo
curl -s "$API/reviews?product=$PID" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).data.reviews;console.log("reviews:",r.length,"| by:",r[0].user.name,"| rating:",r[0].rating)})'
# 5. denormalized recalc (expect rating 5, numReviews 1)
curl -s "$API/products/askr-kontakt-smart-plug-duo" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).data.product;console.log("product rating:",p.rating,"numReviews:",p.numReviews)})'
# 6. update own (expect rating 4 back, then product rating 4)
RID=$(curl -s "$API/reviews?product=$PID" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.reviews[0]._id))')
curl -s -b $JAR -X PUT $API/reviews/$RID -H 'Content-Type: application/json' -d '{"rating":4,"title":"Superb plugs","comment":"Still great, minor app quirks."}' | head -c 120; echo
# 7. admin cannot EDIT someone else's review (expect 404)
curl -s -b $AJAR -X PUT $API/reviews/$RID -H 'Content-Type: application/json' -d '{"rating":1,"title":"hijack","comment":"admin edit attempt"}' | head -c 100; echo
# 8. validation (expect 400 rating message)
curl -s -b $JAR -X PUT $API/reviews/$RID -H 'Content-Type: application/json' -d '{"rating":9,"title":"bad","comment":"bad rating"}' | head -c 110; echo
# 9. admin CAN delete (expect success), recalc back to 0 (expect rating 0, numReviews 0)
curl -s -b $AJAR -X DELETE $API/reviews/$RID | head -c 80; echo
curl -s "$API/products/askr-kontakt-smart-plug-duo" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).data.product;console.log("after delete — rating:",p.rating,"numReviews:",p.numReviews)})'
```

Expected: (1) 201 with `"name":"Erik Demo"`; (2) `"You have already reviewed this product"`; (3) `"Only verified purchasers can review this product"`; (4) `"Not logged in"` then `reviews: 1 | by: Erik Demo | rating: 5`; (5) `rating: 5 numReviews: 1`; (6) success then (implicitly) recalc; (7) `"Review not found"`; (8) `"Rating must be between 1 and 5"`; (9) success, then `rating: 0 numReviews: 0`. Leave the DB with **no reviews** (step 9 cleans up).

---

### Task 2: Wishlist API

**Files:**
- Create: `server/controllers/wishlistController.js`
- Create: `server/routes/wishlistRoutes.js`
- Modify: `server/app.js` (mount)

- [ ] **Step 1: Wishlist controller**

Create `server/controllers/wishlistController.js`:

```js
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
```

- [ ] **Step 2: Wishlist routes**

Create `server/routes/wishlistRoutes.js`:

```js
import { Router } from 'express';
import { param } from 'express-validator';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlistController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

// The wishlist only exists on the account — no guest flavor (spec decision).
router.use(protect);

const productIdParam = param('productId').isMongoId().withMessage('Invalid product id');

router.get('/', getWishlist);
router.post('/:productId', [productIdParam], validate, addToWishlist);
router.delete('/:productId', [productIdParam], validate, removeFromWishlist);

export default router;
```

- [ ] **Step 3: Mount** — in `server/app.js`, add `import wishlistRoutes from './routes/wishlistRoutes.js';` and `app.use('/api/v1/wishlist', wishlistRoutes);` right after the reviews mount.

- [ ] **Step 4: Lint** — `npm run lint --prefix server`, exit 0.

- [ ] **Step 5: Verify with curl**

```bash
JAR=/tmp/nc6-demo.cookies; API=http://localhost:5001/api/v1
PID=$(curl -s "$API/products" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.products[0]._id))')
curl -s $API/wishlist | head -c 80; echo                                     # guest → 401
curl -s -b $JAR -X POST $API/wishlist/$PID | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const w=JSON.parse(d).data.wishlist;console.log("added — size:",w.length,"| fields:",Object.keys(w[0]).sort().join(","))})'
curl -s -b $JAR -X POST $API/wishlist/$PID | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("re-add — size:",JSON.parse(d).data.wishlist.length))'   # idempotent → still 1
curl -s -b $JAR -X DELETE $API/wishlist/$PID | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("removed — size:",JSON.parse(d).data.wishlist.length))' # → 0
curl -s -b $JAR -X DELETE $API/wishlist/$PID | head -c 60; echo              # no-op remove → success
curl -s -b $JAR -X POST $API/wishlist/000000000000000000000000 | head -c 80; echo  # → 404 Product not found
```

Expected: 401; added size 1 with populated fields (incl. `brand`, `slug`, `rating`); re-add still 1; removed 0; no-op success; 404. Leave the wishlist **empty**.

---

### Task 3: WishlistContext + heart button + card/page integration

**Files:**
- Create: `client/src/context/WishlistContext.jsx`
- Modify: `client/src/main.jsx`
- Create: `client/src/components/wishlist/WishlistButton.jsx` + `WishlistButton.module.css`
- Modify: `client/src/components/products/ProductCard.jsx` + `ProductCard.module.css`
- Modify: `client/src/pages/ProductPage.jsx` (heart only — reviews land in Task 5)

- [ ] **Step 1: WishlistContext**

Create `client/src/context/WishlistContext.jsx`:

```jsx
import { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

/**
 * Account-only wishlist (no guest flavor — spec decision). Holds the
 * populated product list; membership checks derive from it. Every
 * mutation adopts the server's response, like CartContext does.
 */
const initialState = { items: [], status: 'loading' };

function wishlistReducer(state, action) {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.payload, status: 'ready' };
    default:
      return state;
  }
}

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { status: authStatus } = useAuth();
  const addToast = useToast();
  const [state, dispatch] = useReducer(wishlistReducer, initialState);
  const isAuthed = authStatus === 'authenticated';

  useEffect(() => {
    if (authStatus === 'loading') return undefined;

    if (authStatus === 'guest') {
      dispatch({ type: 'SET_ITEMS', payload: [] });
      return undefined;
    }

    let cancelled = false;
    api
      .get('/wishlist')
      .then(({ data }) => !cancelled && dispatch({ type: 'SET_ITEMS', payload: data.data.wishlist }))
      .catch(() => !cancelled && dispatch({ type: 'SET_ITEMS', payload: [] }));
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  /** Toggle membership. Returns quietly for guests (after a nudge toast). */
  const toggle = useCallback(
    async (product) => {
      if (!isAuthed) {
        addToast('Log in to save favorites', 'error');
        return;
      }
      const saved = state.items.some((item) => item._id === product._id);
      const { data } = saved
        ? await api.delete(`/wishlist/${product._id}`)
        : await api.post(`/wishlist/${product._id}`);
      dispatch({ type: 'SET_ITEMS', payload: data.data.wishlist });
    },
    [isAuthed, state.items, addToast]
  );

  const value = useMemo(
    () => ({
      items: state.items,
      status: state.status,
      count: state.items.length,
      has: (productId) => state.items.some((item) => item._id === productId),
      toggle,
    }),
    [state, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}
```

- [ ] **Step 2: Provider wiring** — in `client/src/main.jsx`, import `WishlistProvider` and nest it inside `CartProvider` (order among the two doesn't matter; both need Auth + Toast):

```jsx
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <App />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
```

- [ ] **Step 3: Heart button**

Create `client/src/components/wishlist/WishlistButton.jsx`:

```jsx
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../api/axios';
import styles from './WishlistButton.module.css';

/**
 * Heart toggle for a product. Guests get a login nudge (handled inside
 * WishlistContext.toggle). Never nest this inside a Link/anchor — render
 * it as an absolutely-positioned sibling instead.
 */
export default function WishlistButton({ product, className = '' }) {
  const { has, toggle } = useWishlist();
  const addToast = useToast();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const saved = has(product._id);

  const handleToggle = async () => {
    setBusy(true);
    try {
      await toggle(product);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      type="button"
      className={`${styles.heart} ${saved ? styles.saved : ''} ${className}`.trim()}
      onClick={handleToggle}
      disabled={busy}
      whileTap={reduceMotion ? undefined : { scale: 0.85 }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </motion.button>
  );
}
```

Create `client/src/components/wishlist/WishlistButton.module.css`:

```css
.heart {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg) 65%, transparent);
  backdrop-filter: blur(6px);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.heart:hover:not(:disabled) {
  color: var(--color-danger);
}

.heart:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.saved {
  color: var(--color-danger);
}
```

- [ ] **Step 4: ProductCard heart overlay**

In `client/src/components/products/ProductCard.jsx`: import `WishlistButton` and add it as a **sibling of the Link** (buttons must never nest inside anchors), absolutely positioned:

```jsx
import WishlistButton from '../wishlist/WishlistButton';
```

and inside `motion.li`, after the closing `</Link>`:

```jsx
      <WishlistButton product={product} className={styles.wishlist} />
```

Append to `client/src/components/products/ProductCard.module.css` (the `.card` class already has `position: relative` — verify; if not, add it):

```css
.wishlist {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 2;
}
```

- [ ] **Step 5: ProductPage heart** — in `client/src/pages/ProductPage.jsx`, import `WishlistButton` and render it inside the existing `styles.actions` div, after the Add-to-cart `<Button>`:

```jsx
            <WishlistButton product={product} />
```

- [ ] **Step 6: Lint + build** — `npm run lint --prefix client` exit 0, `npm run build --prefix client` success.

---

### Task 4: Wishlist page + route + profile link

**Files:**
- Create: `client/src/pages/WishlistPage.jsx` + `WishlistPage.module.css`
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/ProfilePage.jsx`

- [ ] **Step 1: Wishlist page**

Create `client/src/pages/WishlistPage.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import ProductGrid from '../components/products/ProductGrid';
import Spinner from '../components/ui/Spinner';
import styles from './WishlistPage.module.css';

export default function WishlistPage() {
  const { items, status, count } = useWishlist();

  if (status === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (count === 0) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>Your wishlist is empty</h1>
        <p>Tap the heart on any product to save it here.</p>
        <Link to="/products" className={styles.browse}>
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        Your wishlist <span>({count} {count === 1 ? 'item' : 'items'})</span>
      </h1>
      {/* Cards carry their own hearts — toggling one off removes it live. */}
      <ProductGrid products={items} />
    </main>
  );
}
```

Create `client/src/pages/WishlistPage.module.css`:

```css
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.title {
  font-size: 2rem;
  margin-bottom: var(--space-8);
}

.title span {
  color: var(--color-text-muted);
  font-size: 1.125rem;
  font-weight: 400;
  font-family: var(--font-body);
}

.empty {
  text-align: center;
  padding-top: var(--space-16);
  display: grid;
  justify-items: center;
  gap: var(--space-4);
}

.empty p {
  color: var(--color-text-muted);
}

.browse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3) var(--space-6);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.01em;
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.browse:hover {
  background: var(--color-accent-strong);
}
```

NOTE for the implementer: check `client/src/components/products/ProductGrid.jsx` before using — if it expects props beyond `products` (or orchestrates stagger variants needing a parent), adapt the usage and report it.

- [ ] **Step 2: Route** — in `client/src/App.jsx`, import `WishlistPage` and add inside the ProtectedRoute block:

```jsx
            <Route path="/wishlist" element={page(<WishlistPage />)} />
```

- [ ] **Step 3: Profile link** — in `client/src/pages/ProfilePage.jsx`, next to the existing "Order history →" link, add:

```jsx
        <Link to="/wishlist" className={styles.ordersLink}>
          Wishlist →
        </Link>
```

(reusing the existing `.ordersLink` class; if the two links need spacing, wrap both in a flex div with `gap: var(--space-4)` — implementer's judgment, report what you did).

- [ ] **Step 4: Lint + build** — both clean.

---

### Task 5: Reviews UI on the product page

**Files:**
- Create: `client/src/components/reviews/StarInput.jsx` + `StarInput.module.css`
- Create: `client/src/components/reviews/ReviewForm.jsx` + `ReviewForm.module.css`
- Create: `client/src/components/reviews/ReviewsSection.jsx` + `ReviewsSection.module.css`
- Modify: `client/src/pages/ProductPage.jsx`

- [ ] **Step 1: Star input (accessible radio group)**

Create `client/src/components/reviews/StarInput.jsx`:

```jsx
import { useState } from 'react';
import styles from './StarInput.module.css';

/**
 * 1–5 star picker as a real radio group: arrow keys + labels work like
 * native radios; the visual is the classic hover-fill star row.
 */
export default function StarInput({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className={styles.group} onMouseLeave={() => setHovered(0)}>
      <legend className={styles.legend}>Your rating</legend>
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          className={`${styles.star} ${star <= shown ? styles.filled : ''}`.trim()}
          onMouseEnter={() => setHovered(star)}
        >
          <input
            type="radio"
            name="rating"
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className={styles.input}
          />
          <span aria-hidden="true">★</span>
          <span className={styles.srOnly}>
            {star} {star === 1 ? 'star' : 'stars'}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
```

Create `client/src/components/reviews/StarInput.module.css`:

```css
.group {
  display: inline-flex;
  gap: var(--space-1);
  border: none;
  padding: 0;
}

.legend {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.star {
  font-size: 1.75rem;
  line-height: 1;
  color: var(--color-border);
  cursor: pointer;
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.star:hover {
  transform: scale(1.15);
}

.filled {
  color: var(--color-warning);
}

.input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

/* Keyboard focus ring on the star the hidden radio belongs to */
.star:has(.input:focus-visible) {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
```

- [ ] **Step 2: Review form (create + edit)**

Create `client/src/components/reviews/ReviewForm.jsx`:

```jsx
import { useState } from 'react';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import StarInput from './StarInput';
import styles from './ReviewForm.module.css';

/**
 * Create or edit a review. `existing` (a review object) switches the form
 * into edit mode. Calls onSaved(review) with the server's populated copy.
 */
export default function ReviewForm({ productId, existing = null, onSaved, onCancel }) {
  const addToast = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      addToast('Pick a star rating first', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = existing
        ? await api.put(`/reviews/${existing._id}`, { rating, title, comment })
        : await api.post('/reviews', { productId, rating, title, comment });
      addToast(data.message);
      onSaved(data.data.review);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.heading}>{existing ? 'Edit your review' : 'Write a review'}</h3>
      <StarInput value={rating} onChange={setRating} />
      <Input
        id="review-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={2}
        maxLength={100}
      />
      <div className={styles.field}>
        <label htmlFor="review-comment" className={styles.commentLabel}>
          Your review
        </label>
        <textarea
          id="review-comment"
          className={styles.textarea}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
          minLength={2}
          maxLength={1000}
          rows={4}
        />
      </div>
      <div className={styles.actions}>
        <Button type="submit" isLoading={saving}>
          {existing ? 'Save changes' : 'Publish review'}
        </Button>
        {existing && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
```

Create `client/src/components/reviews/ReviewForm.module.css`:

```css
.form {
  display: grid;
  gap: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.heading {
  font-size: 1.125rem;
}

.field {
  display: grid;
  gap: var(--space-2);
}

.commentLabel {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.textarea {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  resize: vertical;
  min-height: 96px;
  transition: border-color var(--transition-fast);
}

.textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.cancel {
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.cancel:hover {
  color: var(--color-text);
}
```

- [ ] **Step 3: Reviews section**

Create `client/src/components/reviews/ReviewsSection.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Rating from '../ui/Rating';
import Spinner from '../ui/Spinner';
import ReviewForm from './ReviewForm';
import styles from './ReviewsSection.module.css';

/**
 * The product page's review block: list + (for eligible users) the form.
 * Eligibility = logged in, has a paid order containing this product, and
 * hasn't reviewed it yet — the server re-enforces all three; the client
 * checks only decide what UI to show.
 *
 * onStatsChange(rating, numReviews) lets the parent refresh the product's
 * denormalized header rating without refetching the product.
 */
export default function ReviewsSection({ productId, onStatsChange }) {
  const { user, status: authStatus } = useAuth();
  const addToast = useToast();
  const [reviews, setReviews] = useState(null); // null = loading
  const [purchased, setPurchased] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reviews are public — always fetched.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/reviews?product=${productId}`)
      .then(({ data }) => !cancelled && setReviews(data.data.reviews))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Purchase check drives whether the form shows (server still enforces).
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setPurchased(false);
      return undefined;
    }
    let cancelled = false;
    api
      .get('/orders/mine')
      .then(({ data }) => {
        if (cancelled) return;
        const bought = data.data.orders.some(
          (order) => order.isPaid && order.orderItems.some((item) => item.product === productId)
        );
        setPurchased(bought);
      })
      .catch(() => !cancelled && setPurchased(false));
    return () => {
      cancelled = true;
    };
  }, [authStatus, productId]);

  if (reviews === null) {
    return (
      <section className={styles.section} aria-busy="true">
        <h2>Reviews</h2>
        <Spinner />
      </section>
    );
  }

  const ownReview = user ? reviews.find((review) => review.user._id === user.id) : null;
  const average = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 0;

  /** Recompute the denormalized stats the same way the server does. */
  const publishStats = (nextReviews) => {
    const avg = nextReviews.length
      ? Math.round((nextReviews.reduce((sum, review) => sum + review.rating, 0) / nextReviews.length) * 10) / 10
      : 0;
    onStatsChange(avg, nextReviews.length);
  };

  const handleSaved = (review) => {
    const next = ownReview
      ? reviews.map((item) => (item._id === review._id ? review : item))
      : [review, ...reviews];
    setReviews(next);
    setEditing(false);
    publishStats(next);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/reviews/${ownReview._id}`);
      const next = reviews.filter((review) => review._id !== ownReview._id);
      setReviews(next);
      setEditing(false);
      publishStats(next);
      addToast('Review deleted');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="reviews-heading">
      <div className={styles.header}>
        <h2 id="reviews-heading">Reviews</h2>
        {reviews.length > 0 && <Rating value={average} count={reviews.length} />}
      </div>

      {/* Form slot: create (purchased, no review yet) or edit (own review). */}
      {authStatus === 'authenticated' && purchased && !ownReview && (
        <ReviewForm productId={productId} onSaved={handleSaved} />
      )}
      {ownReview && editing && (
        <ReviewForm
          productId={productId}
          existing={ownReview}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      )}

      {reviews.length === 0 ? (
        <p className={styles.emptyNote}>
          No reviews yet.{' '}
          {authStatus !== 'authenticated' && (
            <>
              <Link to="/login" className={styles.loginLink}>
                Log in
              </Link>{' '}
              to review a product you have bought.
            </>
          )}
        </p>
      ) : (
        <ul className={styles.list}>
          {reviews.map((review) => (
            <li key={review._id} className={styles.review}>
              <div className={styles.reviewHeader}>
                <Rating value={review.rating} />
                <span className={styles.author}>{review.user.name}</span>
                <time className={styles.date} dateTime={review.createdAt}>
                  {new Date(review.createdAt).toLocaleDateString('sv-SE')}
                </time>
              </div>
              <h3 className={styles.reviewTitle}>{review.title}</h3>
              <p className={styles.comment}>{review.comment}</p>
              {ownReview && review._id === ownReview._id && !editing && (
                <div className={styles.ownActions}>
                  <button className={styles.edit} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button className={styles.delete} onClick={handleDelete} disabled={deleting}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Create `client/src/components/reviews/ReviewsSection.module.css`:

```css
.section {
  margin-top: var(--space-12);
  display: grid;
  gap: var(--space-6);
}

.header {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.header h2 {
  font-size: 1.5rem;
}

.emptyNote {
  color: var(--color-text-muted);
}

.loginLink {
  color: var(--color-accent);
}

.list {
  list-style: none;
  display: grid;
  gap: var(--space-4);
}

.review {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-6);
  display: grid;
  gap: var(--space-2);
}

.reviewHeader {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.author {
  font-weight: 600;
  font-size: 0.9375rem;
}

.date {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.reviewTitle {
  font-size: 1rem;
}

.comment {
  color: var(--color-text-muted);
}

.ownActions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.edit {
  color: var(--color-accent);
  font-size: 0.875rem;
}

.delete {
  color: var(--color-danger);
  font-size: 0.875rem;
}

.delete:disabled {
  opacity: 0.5;
}
```

- [ ] **Step 4: ProductPage integration** — in `client/src/pages/ProductPage.jsx`: import `ReviewsSection`, then insert between the closing `</div>` of `styles.layout` and the related-products section:

```jsx
      <ReviewsSection
        productId={product._id}
        onStatsChange={(rating, numReviews) =>
          setData((d) => ({ ...d, product: { ...d.product, rating, numReviews } }))
        }
      />
```

(The page's `<Rating value={product.rating} count={product.numReviews} />` header now updates live after review writes.)

- [ ] **Step 5: Lint + build** — both clean.

---

### Task 6: Final verification + phase commit

- [ ] **Step 1:** `npm run lint` at root — exit 0. `npm run build --prefix client` — success.
- [ ] **Step 2:** Re-run Task 1 + Task 2 curl blocks end-to-end; every expectation holds; DB left with no reviews, empty wishlist.
- [ ] **Step 3: Browser flows** (both dev servers; assert on DOM/URL):
1. **Wishlist:** guest clicks a heart on the catalog → "Log in to save favorites" toast, nothing saved. Log in as demo → heart fills on click; catalog and product page hearts agree; `/wishlist` shows the card grid with count; toggling a heart off on the wishlist page removes the card; profile shows "Wishlist →"; empty state after removing all.
2. **Reviews:** on a product demo has bought (smart plug or lamp): form visible with star picker → publish (e.g. 5★) → toast, review appears with author + date, header rating on the page updates to 5.0 (1), catalog card shows the new rating after reload. Edit own review (change to 4★) → updates live. As admin (no purchase): no form, but list visible; guest sees "Log in to review" note. Delete own review → list empties, rating resets to "No reviews yet".
3. Rating recalc double-check via API after each browser mutation if in doubt.
- [ ] **Step 4:** `git status` / `git diff --stat` — files match this plan's File Structure (+ this plan doc).
- [ ] **Step 5: Commit + push**

```bash
git add -A
git commit -m "Phase 6: reviews (verified purchasers, rating recalc) + wishlist"
git push
```

(No attribution trailers; push pre-authorized per phase.)

---

## Execution deviations (2026-07-04)

1. `ReviewsSection.jsx`: the `purchased` boolean uses `useReducer` instead of `useState` (eslint react-hooks/set-state-in-effect rejects synchronous setState in effects; matches the codebase's reducer convention).
2. `ProfilePage`: the two links (Order history / Wishlist) are wrapped in a `.links` flex div with `gap: var(--space-4)` (documented judgment call).
3. `errorHandler.js`: VersionError message generalized from "Your cart changed…" to "Your data changed…" — wishlist saves share the same 409 path now.

Accepted minors from final quality review (flagged, deliberate): recalc race can persist a stale aggregate until the next review write (self-heals; rare given the unique index); edit-mode shows the published review in the list below the edit form; duplicated avg formula in ReviewsSection; sequential recalc+populate awaits; `populatedWishlist`/`populatedCart` are structural twins (shared-helper candidate for a later refactor).

## Self-review notes

- **Spec coverage:** separate Review collection ✓, compound unique `{user, product}` ✓, static recalcs denormalized rating/numReviews after every write (create/update/delete all call it) ✓, controller enforces verified purchaser via paid order containing the product ✓, wishlist embedded on User (schema already had it; endpoints + UI here) ✓, envelope/validators/protect conventions ✓.
- **Type consistency:** review shape `{ _id, user: {_id, name}, product, rating, title, comment, createdAt }` consistent across controller (populate 'user', 'name'), ReviewsSection (uses `review.user._id`, `review.user.name`, `review.createdAt`), ReviewForm (`data.data.review`). `useAuth().user.id` (serializeUser exposes `id`, not `_id`) — ReviewsSection compares `review.user._id === user.id` ✓ (both are the same ObjectId as strings). Wishlist item = populated product with `_id` — WishlistContext `has()` compares `item._id === productId` ✓; ProductCard/ProductGrid consume the same product fields the wishlist endpoint selects (incl. `brand`) ✓.
- **Known trade-offs:** ProfilePage's wishlist/cart counters read the stale login-time `user` snapshot, not the live contexts (pre-existing; Phase 8 polish candidate). Eligibility check duplicates server logic client-side for UX (server remains the enforcer). `orders/mine` is fetched per product page visit by authed users — small, acceptable; could be cached in a context later. Review list has no pagination (portfolio scale).
