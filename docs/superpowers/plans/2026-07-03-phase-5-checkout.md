# Phase 5 — Checkout + Stripe + Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paid checkout end-to-end — server-side priced PaymentIntents, Stripe PaymentElement checkout page, order creation with cart snapshots + stock decrement, and order history/detail pages — per `docs/specs/2026-07-02-nordcart-design.md` Phase 5.

**Architecture:** The server is the only source of truth for money: `POST /orders/payment-intent` re-validates the user's cart against live products (Phase 4's documented carry-forward — `GET /cart` never re-clamps) and creates a PaymentIntent priced from DB prices, never client input. The client confirms the payment with Stripe.js (`PaymentElement`, `redirect: 'if_required'`), then `POST /orders` verifies the intent server-side (status, owner, amount), snapshots the cart into an immutable order, decrements stock atomically, and clears the cart. No webhooks — verification happens at order creation (documented trade-off: fine for a portfolio app, a production shop would add a webhook as backstop).

**Tech Stack:** `stripe` (server SDK), `@stripe/stripe-js` + `@stripe/react-stripe-js` (client), Express 5 patterns from Phases 2–4 (async throws → central errorHandler, `{ success, message, data }` envelope, express-validator + `validate`), React Context/CSS Modules conventions.

**Testing & commit conventions:** identical to Phase 4 — no test framework (curl + browser verification with exact commands), single phase commit at the end (`Phase 5: …`, NO attribution trailers), push after the phase completes (standing user request).

## Prerequisites — Stripe test keys (USER ACTION, verify before Task 2)

`server/.env` currently has the placeholder `STRIPE_SECRET_KEY=sk_test_...` and `client/.env` does not exist. Before runtime verification can work the user must supply real **test-mode** keys from https://dashboard.stripe.com/test/apikeys:

1. `server/.env`: set `STRIPE_SECRET_KEY=sk_test_<real>`
2. Create `client/.env` (gitignored — verify with `git check-ignore client/.env`) containing:
   `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_<real>`

Quick validity check (expects a JSON list, not an auth error):
```bash
source /Users/arbenkurti/Documents/Proggramering/e-commerce/server/.env 2>/dev/null; curl -s https://api.stripe.com/v1/payment_methods -u "$STRIPE_SECRET_KEY:" -G -d type=card -d limit=1 | head -c 120
```
Implementation Tasks 1, 3, 4 can proceed without keys; Task 2's curl verification and Task 5's browser flow are blocked until the keys are real.

**Environment reminders:** API on port 5001 (AirPlay squats 5000); `npm run dev --prefix server` / `--prefix client`; demo login demo@nordcart.se / Demo1234!; occluded Chrome freezes Framer Motion — assert on DOM/URL. Stripe test card in the browser: `4242 4242 4242 4242`, any future expiry, any CVC.

---

## File Structure

**Server:**
- Create: `server/config/stripe.js` — singleton Stripe client; throws a clear error if `STRIPE_SECRET_KEY` is missing/placeholder.
- Create: `server/models/Order.js` — order + snapshot item + shipping address schemas, unique index on `paymentResult.paymentIntentId`.
- Create: `server/controllers/orderController.js` — `createPaymentIntent`, `createOrder`, `getMyOrders`, `getOrderById` + module-local `priceCart` helper (single pricing authority).
- Create: `server/routes/orderRoutes.js` — all behind `protect`; **`/mine` must be declared before `/:id`**.
- Modify: `server/app.js` — mount `/api/v1/orders` (Phase 5 placeholder comment).
- Modify: `server/package.json` — add `stripe` dependency (via `npm install stripe --prefix server`).

**Client:**
- Create: `client/src/utils/stripe.js` — `loadStripe` singleton from `VITE_STRIPE_PUBLISHABLE_KEY`.
- Create: `client/src/pages/CheckoutPage.jsx` + `CheckoutPage.module.css` — protected; creates the intent, renders address form + `PaymentElement`, places the order.
- Create: `client/src/pages/OrderPage.jsx` + `OrderPage.module.css` — order confirmation/detail.
- Create: `client/src/pages/OrdersPage.jsx` + `OrdersPage.module.css` — order history list.
- Modify: `client/src/App.jsx` — protected routes `/checkout`, `/orders`, `/orders/:id`.
- Modify: `client/src/pages/CartPage.jsx` — "Proceed to checkout" navigates to `/checkout` (replaces the placeholder toast).
- Modify: `client/src/pages/ProfilePage.jsx` + `ProfilePage.module.css` — "Order history →" link.
- Modify: `client/package.json` — add `@stripe/stripe-js`, `@stripe/react-stripe-js`.

**Pricing rules (decided here, single source: `priceCart` in orderController):** prices are VAT-inclusive integer öre. `itemsPrice` = Σ live price × qty; `shippingPrice` = 0 if `itemsPrice ≥ 100000` (1 000 kr) else `4900`; `taxPrice` = the included 25 % VAT portion = `Math.round(itemsPrice * 0.2)` (informational); `totalPrice = itemsPrice + shippingPrice` — this is the amount charged.

---

### Task 1: Stripe config + Order model

**Files:**
- Create: `server/config/stripe.js`
- Create: `server/models/Order.js`
- Modify: `server/package.json` (dependency)

- [ ] **Step 1: Install the server SDK**

Run: `npm install stripe --prefix /Users/arbenkurti/Documents/Proggramering/e-commerce/server`
Expected: `added 1 package` (may add a couple of sub-deps), exit 0.

- [ ] **Step 2: Write the Stripe config**

Create `server/config/stripe.js`:

```js
import Stripe from 'stripe';

/**
 * Singleton Stripe client (test mode). Fails loudly at first use if the
 * key is missing or still the .env.example placeholder — a half-configured
 * checkout should error clearly, not create 401s deep inside a request.
 */
let client;

const getStripe = () => {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.includes('...')) {
      throw new Error('STRIPE_SECRET_KEY is not configured — set a real test key in server/.env');
    }
    client = new Stripe(key);
  }
  return client;
};

export default getStripe;
```

- [ ] **Step 3: Write the Order model**

Create `server/models/Order.js`:

```js
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
```

- [ ] **Step 4: Lint**

Run: `npm run lint --prefix server` — expected exit 0.

---

### Task 2: Order controller + routes + mount

**Files:**
- Create: `server/controllers/orderController.js`
- Create: `server/routes/orderRoutes.js`
- Modify: `server/app.js` (import + mount at the Phase 5 placeholder)

- [ ] **Step 1: Write the controller**

Create `server/controllers/orderController.js`:

```js
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import getStripe from '../config/stripe.js';

// --- Pricing rules (single authority — the client only ever displays) ---
// Prices are VAT-inclusive integer öre.
const SHIPPING_FLAT = 4900; // 49 kr
const FREE_SHIPPING_THRESHOLD = 100000; // free at 1 000 kr
const INCLUDED_VAT_FACTOR = 0.2; // 25% VAT included ⇒ VAT part = price × 0.25/1.25

const priceCart = (cart) => {
  const itemsPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingPrice = itemsPrice >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const taxPrice = Math.round(itemsPrice * INCLUDED_VAT_FACTOR);
  return { itemsPrice, shippingPrice, taxPrice, totalPrice: itemsPrice + shippingPrice };
};

/**
 * Load the user's cart with live product data and reject anything that can
 * no longer be bought. Phase 4's GET /cart deliberately doesn't re-clamp,
 * so checkout is where stale carts meet reality.
 */
const loadCheckoutCart = async (user) => {
  await user.populate('cart.product');
  if (user.cart.length === 0) throw new ApiError(400, 'Your cart is empty');

  const gone = user.cart.some((item) => item.product === null);
  if (gone) throw new ApiError(409, 'Some items in your cart are no longer available — please review your cart');

  const short = user.cart.find((item) => item.quantity > item.product.countInStock);
  if (short) {
    throw new ApiError(409, `Not enough stock of ${short.product.name} — only ${short.product.countInStock} left`);
  }

  return user.cart;
};

// POST /api/v1/orders/payment-intent — price the cart server-side and open a payment
export const createPaymentIntent = async (req, res) => {
  const cart = await loadCheckoutCart(req.user);
  const totals = priceCart(cart);

  const intent = await getStripe().paymentIntents.create({
    amount: totals.totalPrice,
    currency: 'sek',
    automatic_payment_methods: { enabled: true },
    // Ties the intent to this user so /orders can verify ownership.
    metadata: { userId: req.user._id.toString() },
  });

  res.json({
    success: true,
    message: 'Payment intent created',
    data: { clientSecret: intent.client_secret, totals },
  });
};

// POST /api/v1/orders  { paymentIntentId, shippingAddress }
export const createOrder = async (req, res) => {
  const { paymentIntentId, shippingAddress } = req.body;

  // Idempotency: a retried/double-submitted request returns the order the
  // first attempt created instead of failing or double-ordering.
  const existing = await Order.findOne({ 'paymentResult.paymentIntentId': paymentIntentId });
  if (existing) {
    if (!existing.user.equals(req.user._id)) throw new ApiError(404, 'Payment not found');
    return res.json({ success: true, message: 'Order already placed', data: { order: existing } });
  }

  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId).catch(() => null);
  if (!intent || intent.metadata.userId !== req.user._id.toString()) {
    throw new ApiError(404, 'Payment not found');
  }
  if (intent.status !== 'succeeded') throw new ApiError(400, 'Payment has not completed');

  const cart = await loadCheckoutCart(req.user);
  const totals = priceCart(cart);
  // The user paid intent.amount. If the cart changed since (another tab),
  // the amounts diverge — refuse rather than ship a mismatched order.
  // (Trade-off: the test-mode payment stays uncaptured-refundable in the
  // dashboard; production would refund automatically or use webhooks.)
  if (intent.amount !== totals.totalPrice) {
    throw new ApiError(409, 'Your cart changed after payment — please contact support');
  }

  const orderItems = cart.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    price: item.product.price,
    image: item.product.images[0]?.url ?? '',
    quantity: item.quantity,
  }));

  let order;
  try {
    order = await Order.create({
      user: req.user._id,
      orderItems,
      shippingAddress,
      paymentResult: { paymentIntentId, status: intent.status },
      ...totals,
      isPaid: true,
      paidAt: new Date(),
    });
  } catch (err) {
    // Two requests raced past the findOne above — the unique index decides.
    if (err.code === 11000) {
      const winner = await Order.findOne({ 'paymentResult.paymentIntentId': paymentIntentId });
      return res.json({ success: true, message: 'Order already placed', data: { order: winner } });
    }
    throw err;
  }

  // Decrement stock atomically, flooring at 0 (a concurrent sale may have
  // taken the last unit — the paid order still stands, per business call).
  await Promise.all(
    orderItems.map((item) =>
      Product.updateOne({ _id: item.product }, [
        { $set: { countInStock: { $max: [0, { $subtract: ['$countInStock', item.quantity] }] } } },
      ])
    )
  );

  req.user.cart = [];
  await req.user.save();

  res.status(201).json({ success: true, message: 'Order placed — thank you!', data: { order } });
};

// GET /api/v1/orders/mine — the logged-in user's order history, newest first
export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort('-createdAt')
    .select('orderItems totalPrice isPaid status createdAt');
  res.json({ success: true, message: 'Your orders', data: { orders } });
};

// GET /api/v1/orders/:id — owner or admin only
export const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id);
  // 404 (not 403) for someone else's order: don't confirm it exists.
  if (!order || (!order.user.equals(req.user._id) && req.user.role !== 'admin')) {
    throw new ApiError(404, 'Order not found');
  }
  res.json({ success: true, message: 'Order fetched', data: { order } });
};
```

- [ ] **Step 2: Write the routes**

Create `server/routes/orderRoutes.js`:

```js
import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createPaymentIntent,
  createOrder,
  getMyOrders,
  getOrderById,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

// Orders are always personal — every route requires a session.
router.use(protect);

router.post('/payment-intent', createPaymentIntent);

router.post(
  '/',
  [
    body('paymentIntentId')
      .isString()
      .matches(/^pi_\w+$/)
      .withMessage('Invalid payment reference'),
    body('shippingAddress.fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required'),
    body('shippingAddress.street').trim().isLength({ min: 2, max: 120 }).withMessage('Street is required'),
    body('shippingAddress.postalCode').trim().isLength({ min: 2, max: 20 }).withMessage('Postal code is required'),
    body('shippingAddress.city').trim().isLength({ min: 1, max: 80 }).withMessage('City is required'),
    body('shippingAddress.country').trim().isLength({ min: 2, max: 60 }).withMessage('Country is required'),
  ],
  validate,
  createOrder
);

// NOTE: /mine must stay above /:id or "mine" gets parsed as an ObjectId.
router.get('/mine', getMyOrders);
router.get('/:id', [param('id').isMongoId().withMessage('Invalid order id')], validate, getOrderById);

export default router;
```

- [ ] **Step 3: Mount the router**

In `server/app.js`: add `import orderRoutes from './routes/orderRoutes.js';` after the cartRoutes import, and replace the placeholder line `// app.use('/api/v1/orders', orderRoutes);     — Phase 5` with `app.use('/api/v1/orders', orderRoutes);` placed right after the cart mount (keep the Phase 6–7 comment lines).

- [ ] **Step 4: Lint**

Run: `npm run lint --prefix server` — expected exit 0.

- [ ] **Step 5: Verify with curl (requires real STRIPE_SECRET_KEY — see Prerequisites)**

With the dev server running (`npm run dev --prefix server`, port 5001):

```bash
cd /Users/arbenkurti/Documents/Proggramering/e-commerce
JAR=/tmp/nordcart.cookies
API=http://localhost:5001/api/v1
SK=$(grep '^STRIPE_SECRET_KEY=' server/.env | cut -d= -f2)

# login + seed the cart with 2 units of the first product
curl -s -c $JAR -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@nordcart.se","password":"Demo1234!"}' | head -c 80; echo
PID=$(curl -s "$API/products" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.products[0]._id))')
STOCK_BEFORE=$(curl -s "$API/products" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.products[0].countInStock))')
curl -s -b $JAR -X POST $API/cart -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"quantity\":2}" > /dev/null

# 1. create the payment intent — expect clientSecret + totals with correct math
curl -s -b $JAR -X POST $API/orders/payment-intent | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).data;console.log("clientSecret:",r.clientSecret.slice(0,10)+"…","totals:",JSON.stringify(r.totals))})'

# 2. order before paying — expect 400 "Payment has not completed"
PI=$(curl -s -b $JAR -X POST $API/orders/payment-intent | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.clientSecret.split("_secret")[0]))')
ADDR='{"fullName":"Erik Demo","street":"Storgatan 1","postalCode":"11122","city":"Stockholm","country":"Sweden"}'
curl -s -b $JAR -X POST $API/orders -H 'Content-Type: application/json' -d "{\"paymentIntentId\":\"$PI\",\"shippingAddress\":$ADDR}" | head -c 120; echo

# 3. pay it server-side with Stripe's test card payment method
curl -s https://api.stripe.com/v1/payment_intents/$PI/confirm -u "$SK:" -d payment_method=pm_card_visa | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("stripe status:",JSON.parse(d).status))'

# 4. create the order — expect 201 with order (isPaid true, snapshots, totals)
curl -s -b $JAR -X POST $API/orders -H 'Content-Type: application/json' -d "{\"paymentIntentId\":\"$PI\",\"shippingAddress\":$ADDR}" | head -c 400; echo
OID=$(curl -s -b $JAR $API/orders/mine | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.orders[0]._id))')

# 5. idempotency: same paymentIntentId again — expect 200 "Order already placed", same order id
curl -s -b $JAR -X POST $API/orders -H 'Content-Type: application/json' -d "{\"paymentIntentId\":\"$PI\",\"shippingAddress\":$ADDR}" | head -c 120; echo

# 6. side effects: cart emptied, stock decremented by 2
curl -s -b $JAR $API/cart | head -c 80; echo
curl -s "$API/products" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const p=JSON.parse(d).data.products[0];console.log('stock now:',p.countInStock,'was:',$STOCK_BEFORE)})"

# 7. reads: mine lists the order; by id works; bad id 400; foreign/unknown id 404
curl -s -b $JAR $API/orders/mine | head -c 200; echo
curl -s -b $JAR $API/orders/$OID | head -c 120; echo
curl -s -b $JAR $API/orders/not-an-id | head -c 100; echo
curl -s -b $JAR $API/orders/000000000000000000000000 | head -c 100; echo
```

Expected: (1) totals math `itemsPrice = 2×price`, shipping 0 or 4900 per threshold, `totalPrice = items+shipping`; (2) `"Payment has not completed"`; (3) `stripe status: succeeded`; (4) 201 envelope, order with `isPaid:true`, snapshot items, `paymentResult.paymentIntentId` = $PI; (5) `"Order already placed"`; (6) `"cart":[]` and stock reduced by exactly 2; (7) list contains the order; fetch works; `"Invalid order id"`; `"Order not found"`.

---

### Task 3: Checkout page (client)

**Files:**
- Create: `client/src/utils/stripe.js`
- Create: `client/src/pages/CheckoutPage.jsx`
- Create: `client/src/pages/CheckoutPage.module.css`
- Modify: `client/src/App.jsx` (protected `/checkout` route)
- Modify: `client/src/pages/CartPage.jsx` (checkout button navigates)
- Modify: `client/package.json` (dependencies)

- [ ] **Step 1: Install client Stripe libraries**

Run: `npm install @stripe/stripe-js @stripe/react-stripe-js --prefix /Users/arbenkurti/Documents/Proggramering/e-commerce/client`
Expected: exit 0.

- [ ] **Step 2: Stripe loader singleton**

Create `client/src/utils/stripe.js`:

```js
import { loadStripe } from '@stripe/stripe-js';

// Module-level singleton: loadStripe must not be called on every render,
// and the publishable key is public by design (pk_test_…).
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
```

- [ ] **Step 3: Checkout page**

Create `client/src/pages/CheckoutPage.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api, { getErrorMessage } from '../api/axios';
import { stripePromise } from '../utils/stripe';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils/format';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import styles from './CheckoutPage.module.css';

// Mirrors global.css — Stripe renders the PaymentElement inside an iframe,
// so CSS variables can't reach it; the appearance API is the only way in.
const appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#5eead4',
    colorBackground: '#191c23',
    colorText: '#e8eaf0',
    colorDanger: '#f87171',
    borderRadius: '10px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};

const EMPTY_ADDRESS = { fullName: '', street: '', postalCode: '', city: '', country: 'Sweden' };

/** Inner form — must live inside <Elements> to use the Stripe hooks. */
function CheckoutForm({ totals, onPlaced }) {
  const stripe = useStripe();
  const elements = useElements();
  const addToast = useToast();
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [paying, setPaying] = useState(false);

  const setField = (field) => (e) => setAddress((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return; // Stripe.js still loading

    setPaying(true);
    // 1. Charge the card. redirect:'if_required' keeps card payments on-page.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (error) {
      addToast(error.message, 'error');
      setPaying(false);
      return;
    }

    // 2. Turn the paid intent into an order.
    try {
      const { data } = await api.post('/orders', {
        paymentIntentId: paymentIntent.id,
        shippingAddress: address,
      });
      onPlaced(data.data.order);
    } catch (err) {
      // Payment went through but the order failed — this is retryable
      // (createOrder is idempotent on the payment id), so tell the user.
      addToast(getErrorMessage(err), 'error');
      setPaying(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <section aria-labelledby="shipping-heading">
        <h2 id="shipping-heading">Shipping address</h2>
        <Input label="Full name" value={address.fullName} onChange={setField('fullName')} required autoComplete="name" />
        <Input label="Street" value={address.street} onChange={setField('street')} required autoComplete="street-address" />
        <div className={styles.addressRow}>
          <Input label="Postal code" value={address.postalCode} onChange={setField('postalCode')} required autoComplete="postal-code" />
          <Input label="City" value={address.city} onChange={setField('city')} required autoComplete="address-level2" />
        </div>
        <Input label="Country" value={address.country} onChange={setField('country')} required autoComplete="country-name" />
      </section>

      <section aria-labelledby="payment-heading">
        <h2 id="payment-heading">Payment</h2>
        <PaymentElement />
      </section>

      <Button type="submit" isLoading={paying} disabled={!stripe} className={styles.payButton}>
        Pay {formatPrice(totals.totalPrice)}
      </Button>
      <p className={styles.testHint}>Test mode — use card 4242 4242 4242 4242, any future expiry, any CVC.</p>
    </form>
  );
}

export default function CheckoutPage() {
  const { items, status: cartStatus, clearCart } = useCart();
  const addToast = useToast();
  const navigate = useNavigate();
  const [intent, setIntent] = useState(null); // { clientSecret, totals }
  const [error, setError] = useState(null);
  // Set before the cart empties on success — stops the guard below from
  // bouncing to /cart in the render between clearCart() and navigation.
  const placedRef = useRef(false);

  useEffect(() => {
    if (cartStatus !== 'ready' || items.length === 0) return undefined;
    let cancelled = false;
    setIntent(null);
    api
      .post('/orders/payment-intent')
      .then(({ data }) => !cancelled && setIntent(data.data))
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
    // Re-price when the cart changes (another tab): a fresh intent replaces
    // the stale-amount one, which Stripe just lets expire.
  }, [cartStatus, items]);

  if (cartStatus === 'ready' && items.length === 0 && !placedRef.current) {
    return <Navigate to="/cart" replace />;
  }

  const handlePlaced = (order) => {
    placedRef.current = true;
    addToast('Order placed — thank you!');
    navigate(`/orders/${order._id}`, { replace: true });
    clearCart(); // server already emptied it; this syncs the client state
  };

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>Checkout unavailable</h1>
        <p>{error}</p>
        <Link to="/cart" className={styles.backLink}>← Back to your cart</Link>
      </main>
    );
  }

  if (!intent) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  const { totals } = intent;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Checkout</h1>
      <div className={styles.layout}>
        {/* key: a new clientSecret must remount Elements — it's immutable per instance */}
        <Elements key={intent.clientSecret} stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance }}>
          <CheckoutForm totals={totals} onPlaced={handlePlaced} />
        </Elements>

        <aside className={styles.summary} aria-label="Order summary">
          <h2>Summary</h2>
          <ul className={styles.items}>
            {items.map((item) => (
              <li key={item.product._id}>
                <span className={styles.itemName}>
                  {item.product.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.product.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Items</dt>
              <dd>{formatPrice(totals.itemsPrice)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{totals.shippingPrice === 0 ? 'Free' : formatPrice(totals.shippingPrice)}</dd>
            </div>
            <div>
              <dt>Incl. 25% VAT</dt>
              <dd>{formatPrice(totals.taxPrice)}</dd>
            </div>
            <div className={styles.total}>
              <dt>Total</dt>
              <dd>{formatPrice(totals.totalPrice)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
```

NOTE for the implementer: check `client/src/components/ui/Input.jsx`'s actual props (label/value/onChange pattern) before using — if its API differs (e.g. expects `id`, or spreads rest props), adapt the address fields accordingly and report the adaptation.

- [ ] **Step 4: Checkout page styles**

Create `client/src/pages/CheckoutPage.module.css`:

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

.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: var(--space-8);
  align-items: start;
}

.form {
  display: grid;
  gap: var(--space-6);
}

.form h2 {
  font-size: 1.25rem;
  margin-bottom: var(--space-4);
}

.addressRow {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--space-4);
}

.payButton {
  width: 100%;
}

.testHint {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  text-align: center;
}

.summary {
  position: sticky;
  top: calc(var(--space-16) + var(--space-4));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: grid;
  gap: var(--space-4);
}

.summary h2 {
  font-size: 1.25rem;
}

.items {
  list-style: none;
  display: grid;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
}

.items li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: 0.9375rem;
}

.itemName {
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary dl {
  display: grid;
  gap: var(--space-2);
}

.summary dl div {
  display: flex;
  justify-content: space-between;
}

.summary dt {
  color: var(--color-text-muted);
}

.summary dd {
  font-variant-numeric: tabular-nums;
}

.total {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-2);
  font-weight: 700;
}

.total dt {
  color: var(--color-text);
}

.error {
  text-align: center;
  padding-top: var(--space-16);
  display: grid;
  justify-items: center;
  gap: var(--space-4);
}

.backLink {
  color: var(--color-accent);
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }

  /* Summary first on mobile: users confirm what they're paying before the form */
  .summary {
    position: static;
    order: -1;
  }
}
```

- [ ] **Step 5: Route + cart button**

In `client/src/App.jsx`: add `import CheckoutPage from './pages/CheckoutPage';` and add inside the existing `<Route element={<ProtectedRoute routesLocation={location} />}>` block:

```jsx
            <Route path="/checkout" element={page(<CheckoutPage />)} />
```

In `client/src/pages/CartPage.jsx`: add `useNavigate` to the react-router-dom import, add `const navigate = useNavigate();` next to the other hooks, and change the checkout button to navigate instead of toasting:

```jsx
          <Button className={styles.checkoutBtn} onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </Button>
```

(Guests clicking it get bounced to /login by ProtectedRoute and — because LoginPage honors `location.state?.from` — land back on /checkout after signing in.)

- [ ] **Step 6: Lint**

Run: `npm run lint --prefix client` — expected exit 0. Also run `npm run build --prefix client` to catch import errors — expected success.

---

### Task 4: Order confirmation + history pages

**Files:**
- Create: `client/src/pages/OrderPage.jsx` + `OrderPage.module.css`
- Create: `client/src/pages/OrdersPage.jsx` + `OrdersPage.module.css`
- Modify: `client/src/App.jsx` (protected `/orders` and `/orders/:id` routes)
- Modify: `client/src/pages/ProfilePage.jsx` + `ProfilePage.module.css` (order-history link)

- [ ] **Step 1: Order detail page**

Create `client/src/pages/OrderPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import { formatPrice } from '../utils/format';
import placeholder from '../assets/placeholder-product.svg';
import Spinner from '../components/ui/Spinner';
import styles from './OrderPage.module.css';

const STATUS_LABELS = { pending: 'Being prepared', shipped: 'Shipped', delivered: 'Delivered' };

export default function OrderPage() {
  const { id } = useParams();
  const [state, setState] = useState({ order: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/orders/${id}`)
      .then(({ data }) => !cancelled && setState({ order: data.data.order, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ order: null, loading: false, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { order, loading, error } = state;

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>{error}</h1>
        <Link to="/orders" className={styles.backLink}>← Your orders</Link>
      </main>
    );
  }

  const placed = new Date(order.createdAt).toLocaleDateString('sv-SE');

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Thanks for your order!</h1>
        <p className={styles.meta}>
          Order <span className={styles.orderId}>{order._id}</span> · placed {placed}
        </p>
        <div className={styles.badges}>
          {order.isPaid && <span className={`${styles.badge} ${styles.paid}`}>Paid</span>}
          <span className={styles.badge}>{STATUS_LABELS[order.status]}</span>
        </div>
      </header>

      <div className={styles.layout}>
        <section aria-labelledby="items-heading">
          <h2 id="items-heading">Items</h2>
          <ul className={styles.items}>
            {order.orderItems.map((item) => (
              <li key={`${item.product}-${item.name}`} className={styles.item}>
                <img
                  src={item.image || placeholder}
                  alt=""
                  onError={(e) => (e.currentTarget.src = placeholder)}
                />
                <div className={styles.itemInfo}>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemQty}>
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className={styles.details}>
          <section aria-labelledby="address-heading">
            <h2 id="address-heading">Shipping to</h2>
            <address className={styles.address}>
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.street}
              <br />
              {order.shippingAddress.postalCode} {order.shippingAddress.city}
              <br />
              {order.shippingAddress.country}
            </address>
          </section>

          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading">Summary</h2>
            <dl className={styles.summary}>
              <div>
                <dt>Items</dt>
                <dd>{formatPrice(order.itemsPrice)}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>{order.shippingPrice === 0 ? 'Free' : formatPrice(order.shippingPrice)}</dd>
              </div>
              <div>
                <dt>Incl. 25% VAT</dt>
                <dd>{formatPrice(order.taxPrice)}</dd>
              </div>
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>{formatPrice(order.totalPrice)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Order detail styles**

Create `client/src/pages/OrderPage.module.css`:

```css
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.header {
  margin-bottom: var(--space-8);
}

.header h1 {
  font-size: 2rem;
}

.meta {
  color: var(--color-text-muted);
  margin-top: var(--space-2);
}

.orderId {
  font-variant-numeric: tabular-nums;
}

.badges {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.badge {
  padding: 2px var(--space-3);
  border-radius: 999px;
  border: 1px solid var(--color-border);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.paid {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-8);
  align-items: start;
}

.layout h2 {
  font-size: 1.125rem;
  margin-bottom: var(--space-3);
}

.items {
  list-style: none;
  display: grid;
  gap: var(--space-3);
}

.item {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: var(--space-4);
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.item img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
}

.itemName {
  font-weight: 600;
}

.itemQty {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.itemTotal {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.details {
  display: grid;
  gap: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.address {
  font-style: normal;
  color: var(--color-text-muted);
  line-height: 1.7;
}

.summary {
  display: grid;
  gap: var(--space-2);
}

.summary div {
  display: flex;
  justify-content: space-between;
}

.summary dt {
  color: var(--color-text-muted);
}

.summary dd {
  font-variant-numeric: tabular-nums;
}

.total {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-2);
  font-weight: 700;
}

.total dt {
  color: var(--color-text);
}

.error {
  text-align: center;
  padding-top: var(--space-16);
}

.backLink {
  color: var(--color-accent);
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Order history page**

Create `client/src/pages/OrdersPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import { formatPrice } from '../utils/format';
import Spinner from '../components/ui/Spinner';
import styles from './OrdersPage.module.css';

const STATUS_LABELS = { pending: 'Being prepared', shipped: 'Shipped', delivered: 'Delivered' };

export default function OrdersPage() {
  const [state, setState] = useState({ orders: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/orders/mine')
      .then(({ data }) => !cancelled && setState({ orders: data.data.orders, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ orders: [], loading: false, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { orders, loading, error } = state;

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (error) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>{error}</h1>
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>No orders yet</h1>
        <p>When you place an order it will show up here.</p>
        <Link to="/products" className={styles.browse}>
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Your orders</h1>
      <ul className={styles.list}>
        {orders.map((order) => {
          const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <li key={order._id}>
              <Link to={`/orders/${order._id}`} className={styles.card}>
                <div>
                  <p className={styles.date}>{new Date(order.createdAt).toLocaleDateString('sv-SE')}</p>
                  <p className={styles.summaryLine}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} · {STATUS_LABELS[order.status]}
                  </p>
                </div>
                <p className={styles.total}>{formatPrice(order.totalPrice)}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Order history styles**

Create `client/src/pages/OrdersPage.module.css`:

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.title {
  font-size: 2rem;
  margin-bottom: var(--space-8);
}

.list {
  list-style: none;
  display: grid;
  gap: var(--space-3);
}

.card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-6);
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}

.card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.date {
  font-weight: 600;
}

.summaryLine {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.total {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.browse:hover {
  background: var(--color-accent-strong);
}
```

- [ ] **Step 5: Routes + profile link**

In `client/src/App.jsx`: add imports for `OrdersPage` and `OrderPage`, and inside the `ProtectedRoute` block add:

```jsx
            <Route path="/orders" element={page(<OrdersPage />)} />
            <Route path="/orders/:id" element={page(<OrderPage />)} />
```

In `client/src/pages/ProfilePage.jsx`: add `import { Link } from 'react-router-dom';` and, directly after the closing `</dl>` of the stats list, add:

```jsx
        <Link to="/orders" className={styles.ordersLink}>
          Order history →
        </Link>
```

Append to `client/src/pages/ProfilePage.module.css`:

```css
.ordersLink {
  display: inline-block;
  margin-top: var(--space-6);
  color: var(--color-accent);
  font-weight: 600;
  transition: color var(--transition-fast);
}

.ordersLink:hover {
  color: var(--color-accent-strong);
}
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint --prefix client` and `npm run build --prefix client` — both expected exit 0.

---

### Task 5: Final verification + phase commit

- [ ] **Step 1: Lint everything** — `npm run lint` at repo root, exit 0.

- [ ] **Step 2: API re-verification** — re-run Task 2 Step 5's curl block end-to-end; every expectation must hold.

- [ ] **Step 3: Browser end-to-end** (both dev servers running; assert on DOM/URL):
1. Log in as demo, add 1–2 products to the cart, open `/cart`, click "Proceed to checkout" → lands on `/checkout` with address form, PaymentElement (dark themed), and a summary whose totals match the cart (shipping 49 kr under 1 000 kr, Free above; VAT line ≈ 20 % of items).
2. Fill the address, enter card `4242 4242 4242 4242` (any future expiry/CVC) inside the Stripe iframe, click "Pay …" → success toast → redirected to `/orders/<id>` showing Paid badge, snapshot items, address, and the same totals.
3. Navbar cart badge is gone (cart cleared); `/cart` shows the empty state; product page shows stock reduced.
4. `/orders` lists the order; the card links back to the detail page; ProfilePage shows the "Order history →" link.
5. Guest flow: log out, add an item, click checkout → bounced to `/login`; log in → back on `/checkout` with the merged cart.
6. Declined card check: repeat checkout with card `4000 0000 0000 0002` → error toast from Stripe, no order created, cart intact.

- [ ] **Step 4: Review the diff** — `git status && git diff --stat`; changed files must match this plan's File Structure exactly (plus this plan file and lockfiles).

- [ ] **Step 5: Commit + push**

```bash
git add -A
git commit -m "Phase 5: checkout — Stripe PaymentIntents, orders with snapshots + stock decrement, order history"
git push
```

(No Co-Authored-By/attribution trailers. Push is pre-authorized per phase per the standing user request.)

---

## Execution deviations (2026-07-03)

Review-driven changes from the planned code:

1. `orderController.js` `createOrder`: order creation + stock decrement + cart clear now run inside `session.withTransaction(...)` — the planned sequential version could leave a paid order with unfinished side effects that the idempotent retry path would never complete (a `VersionError` on the cart save was a concrete trigger). Sequential ops on the session (sessions forbid parallelism). Requires a replica set — fine on Atlas; a standalone local mongod would break checkout.
2. `orderController.js`: Stripe `retrieve` failures are split — `StripeInvalidRequestError` → 404, anything else (outage/network) → logged + 502 retryable, instead of collapsing everything into 404.
3. `orderRoutes.js`: paymentIntentId regex length-capped (`/^pi_\w{1,200}$/`).
4. `CheckoutPage.jsx` restructured vs the plan (eslint react-hooks v7): outer `CheckoutPage` owns guards + a `placed` state; inner `CheckoutFlow` fetches the intent and is remounted via a cart-signature `key` instead of effect-driven re-fetch. `Input` fields carry explicit `id` props (the component requires them).
5. `CheckoutPage.jsx` hardening: `confirmPayment` result with `error.payment_intent.status === 'succeeded'` falls through to the idempotent order POST (retry-after-failed-POST path); `confirmPayment` wrapped in try/catch so a Stripe.js rejection can't leave the button spinning; once `placed`, the page renders a spinner instead of remounting the flow (prevented a guaranteed empty-cart intent request during the exit animation).
6. `utils/stripe.js`: lazy `getStripe()` instead of module-eval `loadStripe` — the eager version fetched js.stripe.com on every page view app-wide.
7. `OrderPage.jsx`: order-item key simplified to `item.product` (unique per order — cart dedupes); `OrdersPage.module.css` `.browse` aligned with CartPage's copy (font-size/letter-spacing).

Runtime-verification fixes (2026-07-03, after real Stripe keys landed — static review could not have caught these):

8. `createPaymentIntent`: `automatic_payment_methods` now sets `allow_redirects: 'never'` — the default allows redirect-based methods (Klarna & co), which makes every confirm demand a `return_url` and broke confirmation outright.
9. Stock decrement: Mongoose 9 requires `updatePipeline: true` to run aggregation-pipeline updates — without it `createOrder` failed post-payment. The transaction proved itself here: the failure rolled back cleanly (no order, stock/cart intact) and the idempotent retry completed the order from the already-paid intent.

Verified end-to-end with real test keys: full curl suite (intent → confirm `pm_card_visa` → order → idempotent re-post → stock −2 → cart cleared → reads); browser checkout with `4242…` card (dark PaymentElement, card-only, order confirmation page, badge cleared); declined card `4000…0002` (localized error toast, no order, cart intact); order history + profile link.

Accepted trade-offs (reviewed, deliberate): no cross-tab cart sync (server 409 is the backstop, comments say so honestly); `.browse` CSS duplicated per page (codebase convention); error-text-as-h1 pattern (matches ProductPage); free-text country; placeholder-key heuristic in config/stripe.js; errorHandler's VersionError message still says "cart" (apt for the transaction-abort case too).

## Self-review notes

- **Spec coverage:** Order schema matches the design doc (user indexed, snapshot items, shippingAddress, paymentResult with PaymentIntent id, four int-öre price fields, isPaid, status enum, timestamps). Stripe test mode ✓. Money integer öre, formatted only client-side ✓. Envelope + validators + protect ✓. Phase 4 carry-forward honored: checkout re-validates every line against live stock/price in `loadCheckoutCart` ✓.
- **Type consistency:** `useCart()` consumed as `{ items, status, clearCart }` (matches Phase 4's context); order fields consumed by OrderPage/OrdersPage (`orderItems[].{name,price,image,quantity}`, `shippingAddress.*`, price fields, `status`, `isPaid`, `createdAt`) all exist on the Task 1 schema; `data.order` / `data.orders` envelope keys match the controller.
- **Known trade-offs (documented, deliberate):** no Stripe webhooks (order creation verifies the intent directly; a crash between payment and order creation is recoverable because createOrder is idempotent on the intent id and the client can retry); amount-mismatch after payment → 409 with support message (cart edits mid-checkout aren't reachable through the UI); stock decrement floors at 0 rather than failing a paid order; `automatic_payment_methods` may show extra methods (Klarna etc.) in the PaymentElement — harmless in test mode.
