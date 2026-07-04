# Phase 7 — Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dashboard — stats overview, product CRUD with Cloudinary image uploads, and order management (status updates) — per `docs/specs/2026-07-02-nordcart-design.md` Phase 7.

**Architecture:** One admin router (`/api/v1/admin`) behind `protect + authorize('admin')` with a single domain controller (stats, product CRUD, orders, upload signature). Images use **signed direct uploads**: the server only issues a short-lived signature; the browser uploads the file straight to Cloudinary and sends back the resulting URL in the product payload — no file bytes ever pass through Express (which caps JSON at 10kb anyway). Product updates go through `doc.set(...) + save()` so the slug pre-save hook regenerates on rename and schema validators run. Client-side, an `AdminRoute` guard (ProtectedRoute's pattern + role check) wraps four pages under `/admin`.

**Tech Stack:** Existing conventions (Express 5 async-throw controllers, ApiError, envelope, express-validator, CSS Modules on global.css tokens, Framer Motion + useReducedMotion). `cloudinary` SDK already installed and configured (`server/config/cloudinary.js`). No new server deps; no client deps.

**Testing & commit conventions:** as Phases 4–6 — no test framework (exact curl + browser verification), single phase commit (`Phase 7: …`, NO attribution trailers), push after the phase.

**Environment:** API :5001, client :5173. admin@nordcart.se / Admin1234! (role admin), demo@nordcart.se / Demo1234! (role user — for 403 tests). **Cloudinary env caveat:** as of writing, `CLOUDINARY_CLOUD_NAME` in `server/.env` is wrong ("cloud_name mismatch" from the ping API) — the user is fixing it. Everything except the actual browser upload verifies without it; the signature endpoint itself works regardless (it just signs). Re-check before the upload verification step: `cd server && CN=$(grep '^CLOUDINARY_CLOUD_NAME=' .env | cut -d= -f2); K=$(grep '^CLOUDINARY_API_KEY=' .env | cut -d= -f2); S=$(grep '^CLOUDINARY_API_SECRET=' .env | cut -d= -f2); curl -s -u "$K:$S" "https://api.cloudinary.com/v1_1/$CN/ping"` → expect `{"status":"ok"}`. Browser gotcha: hidden tab freezes AnimatePresence swaps — keep the window visible or assert via DOM/API on direct navigations.

---

## File Structure

**Server:**
- Create: `server/controllers/adminController.js` — stats, product create/update/delete + get-by-id, all-orders list, order-status update, upload signature.
- Create: `server/routes/adminRoutes.js` — `router.use(protect, authorize('admin'))`, validator chains.
- Modify: `server/app.js` — mount at the Phase 7 placeholder (the last one).

**Client:**
- Create: `client/src/components/layout/AdminRoute.jsx` — ProtectedRoute's exiting-snapshot pattern + role gate.
- Modify: `client/src/components/layout/Navbar.jsx` — "Admin" NavLink for admins (before the profile link).
- Create: `client/src/pages/admin/AdminDashboardPage.jsx` + `.module.css` — stat tiles, low-stock list, recent orders.
- Create: `client/src/pages/admin/AdminProductsPage.jsx` + `.module.css` — product table, delete with two-click confirm, links to the form.
- Create: `client/src/pages/admin/AdminProductFormPage.jsx` + `.module.css` — create/edit form incl. Cloudinary direct upload + image list management.
- Create: `client/src/pages/admin/AdminOrdersPage.jsx` + `.module.css` — orders table with per-row status select.
- Modify: `client/src/App.jsx` — `/admin`, `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`, `/admin/orders` under an `AdminRoute` block.

**API contracts decided here** (all under `/api/v1/admin`, all admin-only):
- `GET /stats` → `{ data: { revenue, orderCount, productCount, userCount, lowStock: [{_id,name,slug,countInStock}], recentOrders: [{_id,user:{name},totalPrice,status,createdAt}] } }` (revenue = Σ totalPrice of paid orders, integer öre).
- `POST /products` (full body) / `PUT /products/:id` / `DELETE /products/:id` / `GET /products/:id` → `{ data: { product } }` (delete → `data: null`; also deletes the product's reviews; carts/wishlists self-heal via Phase 4/6 pruning).
- `GET /orders` → `{ data: { orders } }` — every order, `user` populated with `name email`, newest first.
- `PUT /orders/:id/status` `{ status: 'pending'|'shipped'|'delivered' }` → `{ data: { order } }`.
- `POST /uploads/signature` → `{ data: { timestamp, signature, apiKey, cloudName, folder } }`, folder fixed to `nordcart/products`.

---

### Task 1: Admin API (controller + routes + mount)

**Files:**
- Create: `server/controllers/adminController.js`
- Create: `server/routes/adminRoutes.js`
- Modify: `server/app.js`

- [ ] **Step 1: Controller**

Create `server/controllers/adminController.js`:

```js
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import ApiError from '../utils/ApiError.js';
import cloudinary from '../config/cloudinary.js';

// GET /api/v1/admin/stats — the dashboard's single round-trip
export const getStats = async (_req, res) => {
  const [revenueAgg, productCount, userCount, lowStock, recentOrders] = await Promise.all([
    Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    ]),
    Product.countDocuments(),
    User.countDocuments(),
    Product.find({ countInStock: { $lte: 5 } }).sort('countInStock').limit(8).select('name slug countInStock'),
    Order.find().sort('-createdAt').limit(5).select('totalPrice status createdAt user').populate('user', 'name'),
  ]);

  res.json({
    success: true,
    message: 'Dashboard stats',
    data: {
      revenue: revenueAgg[0]?.revenue ?? 0, // integer öre, like every price
      orderCount: revenueAgg[0]?.count ?? 0,
      productCount,
      userCount,
      lowStock,
      recentOrders,
    },
  });
};

// GET /api/v1/admin/products/:id — the edit form loads by id (public API is slug-only)
export const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, message: 'Product fetched', data: { product } });
};

// POST /api/v1/admin/products
export const createProduct = async (req, res) => {
  const { name, description, brand, category, price, countInStock, images, isFeatured } = req.body;
  const product = await Product.create({ name, description, brand, category, price, countInStock, images, isFeatured });
  res.status(201).json({ success: true, message: `${product.name} created`, data: { product } });
};

// PUT /api/v1/admin/products/:id
export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  const { name, description, brand, category, price, countInStock, images, isFeatured } = req.body;
  // set + save (not findByIdAndUpdate): the slug pre-save hook must see a
  // renamed product, and schema validators must run.
  product.set({ name, description, brand, category, price, countInStock, images, isFeatured });
  await product.save();

  res.json({ success: true, message: `${product.name} updated`, data: { product } });
};

// DELETE /api/v1/admin/products/:id
export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');

  await product.deleteOne();
  // Orphaned reviews would poison future aggregates; carts/wishlists
  // self-heal on their next populate (Phase 4/6 pruning), so they're left alone.
  await Review.deleteMany({ product: product._id });

  res.json({ success: true, message: `${product.name} deleted`, data: null });
};

// GET /api/v1/admin/orders — every order, newest first
export const getAllOrders = async (_req, res) => {
  const orders = await Order.find()
    .sort('-createdAt')
    .select('orderItems totalPrice isPaid status createdAt user')
    .populate('user', 'name email');
  res.json({ success: true, message: 'All orders', data: { orders } });
};

// PUT /api/v1/admin/orders/:id/status  { status }
export const updateOrderStatus = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  order.status = req.body.status;
  await order.save();

  res.json({ success: true, message: `Order marked as ${order.status}`, data: { order } });
};

// POST /api/v1/admin/uploads/signature — short-lived signature for a direct
// browser→Cloudinary upload; file bytes never touch this server.
export const getUploadSignature = (_req, res) => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'nordcart/products';
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, process.env.CLOUDINARY_API_SECRET);

  res.json({
    success: true,
    message: 'Upload signature issued',
    data: { timestamp, signature, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME, folder },
  });
};
```

- [ ] **Step 2: Routes**

Create `server/routes/adminRoutes.js`:

```js
import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getStats,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  updateOrderStatus,
  getUploadSignature,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { PRODUCT_CATEGORIES } from '../models/Product.js';

const router = Router();

// Everything here is staff-only.
router.use(protect, authorize('admin'));

const idParam = param('id').isMongoId().withMessage('Invalid id');

const productRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters'),
  body('description').trim().isLength({ min: 2, max: 2000 }).withMessage('Description must be between 2 and 2000 characters'),
  body('brand').trim().isLength({ min: 1, max: 60 }).withMessage('Brand is required'),
  body('category').isIn(PRODUCT_CATEGORIES).withMessage('Unknown category'),
  body('price').isInt({ min: 0 }).withMessage('Price must be a non-negative integer amount of öre').toInt(),
  body('countInStock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer').toInt(),
  body('images').isArray({ min: 1, max: 8 }).withMessage('At least one image is required'),
  body('images.*.url').isURL({ protocols: ['https'] }).withMessage('Image url must be https'),
  body('images.*.alt').trim().isLength({ min: 2, max: 200 }).withMessage('Every image needs alt text'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean').toBoolean(),
];

router.get('/stats', getStats);

router.post('/products', productRules, validate, createProduct);
router
  .route('/products/:id')
  .get([idParam], validate, getProductById)
  .put([idParam, ...productRules], validate, updateProduct)
  .delete([idParam], validate, deleteProduct);

router.get('/orders', getAllOrders);
router.put(
  '/orders/:id/status',
  [idParam, body('status').isIn(['pending', 'shipped', 'delivered']).withMessage('Unknown status')],
  validate,
  updateOrderStatus
);

router.post('/uploads/signature', getUploadSignature);

export default router;
```

- [ ] **Step 3: Mount** — in `server/app.js`, add `import adminRoutes from './routes/adminRoutes.js';` and replace the final placeholder comment block (`// Feature routers are mounted here…` + `// app.use('/api/v1/admin', adminRoutes);      — Phase 7`) with `app.use('/api/v1/admin', adminRoutes);` after the wishlist mount. All phases are mounted now — the whole placeholder comment can go.

- [ ] **Step 4: Lint** — `npm run lint --prefix server`, exit 0.

- [ ] **Step 5: Verify with curl**

```bash
cd /Users/arbenkurti/Documents/Proggramering/e-commerce
AJAR=/tmp/nc7-admin.cookies; JAR=/tmp/nc7-demo.cookies; API=http://localhost:5001/api/v1
curl -s -c $AJAR -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@nordcart.se","password":"Admin1234!"}' > /dev/null
curl -s -c $JAR -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@nordcart.se","password":"Demo1234!"}' > /dev/null

# 1. non-admin & guest → 403 / 401
curl -s -b $JAR $API/admin/stats | head -c 90; echo
curl -s $API/admin/stats | head -c 60; echo
# 2. stats shape (demo has 2 paid orders: 847+448 kr → revenue 129500 öre)
curl -s -b $AJAR $API/admin/stats | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=JSON.parse(d).data;console.log("revenue:",s.revenue,"orders:",s.orderCount,"products:",s.productCount,"users:",s.userCount,"lowStock:",s.lowStock.length,"recent:",s.recentOrders.length)})'
# 3. create product (expect 201, slug auto-generated)
NEW=$(curl -s -b $AJAR -X POST $API/admin/products -H 'Content-Type: application/json' -d '{"name":"Test Fjord Lamp XR","description":"Temporary product created by Phase 7 verification.","brand":"Fjord","category":"desk","price":123400,"countInStock":7,"images":[{"url":"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600","alt":"A desk lamp on a wooden table"}]}')
echo "$NEW" | head -c 160; echo
NID=$(echo "$NEW" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.product._id))')
echo "$NEW" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("slug:",JSON.parse(d).data.product.slug))'
# 4. get by id; update name → slug regenerates
curl -s -b $AJAR $API/admin/products/$NID | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log("fetched:",JSON.parse(d).data.product.name))'
curl -s -b $AJAR -X PUT $API/admin/products/$NID -H 'Content-Type: application/json' -d '{"name":"Test Fjord Lamp XR Mk2","description":"Temporary product created by Phase 7 verification.","brand":"Fjord","category":"desk","price":123400,"countInStock":7,"images":[{"url":"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600","alt":"A desk lamp on a wooden table"}]}' | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).data.product;console.log("renamed:",p.name,"| new slug:",p.slug)})'
# 5. validation (expect 400 category message)
curl -s -b $AJAR -X POST $API/admin/products -H 'Content-Type: application/json' -d '{"name":"Bad Cat","description":"Nope not valid.","brand":"X","category":"nope","price":100,"countInStock":1,"images":[{"url":"https://example.com/x.jpg","alt":"An image"}]}' | head -c 90; echo
# 6. orders list + status flow (grab demo's newest order)
OID=$(curl -s -b $AJAR $API/admin/orders | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.orders[0]._id))')
curl -s -b $AJAR $API/admin/orders | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const o=JSON.parse(d).data.orders;console.log("orders:",o.length,"| first by:",o[0].user.name,o[0].user.email,"| status:",o[0].status)})'
curl -s -b $AJAR -X PUT $API/admin/orders/$OID/status -H 'Content-Type: application/json' -d '{"status":"shipped"}' | head -c 90; echo
curl -s -b $AJAR -X PUT $API/admin/orders/$OID/status -H 'Content-Type: application/json' -d '{"status":"teleported"}' | head -c 80; echo
curl -s -b $AJAR -X PUT $API/admin/orders/$OID/status -H 'Content-Type: application/json' -d '{"status":"pending"}' > /dev/null  # restore
# 7. upload signature shape (works even with wrong cloud name — it only signs)
curl -s -b $AJAR -X POST $API/admin/uploads/signature | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const s=JSON.parse(d).data;console.log("sig len:",s.signature.length,"| folder:",s.folder,"| has ts/key/cloud:",!!s.timestamp,!!s.apiKey,!!s.cloudName)})'
# 8. delete the test product (expect success, then admin 404 on re-fetch)
curl -s -b $AJAR -X DELETE $API/admin/products/$NID | head -c 80; echo
curl -s -b $AJAR $API/admin/products/$NID | head -c 60; echo
```

Expected: (1) `"You do not have permission to do that"` then `"Not logged in"`; (2) `revenue: 129500 orders: 2` + plausible counts; (3) 201 with `slug: test-fjord-lamp-xr`; (4) fetched + `new slug: test-fjord-lamp-xr-mk2`; (5) `"Unknown category"`; (6) orders ≥2 with user name/email, `"Order marked as shipped"`, `"Unknown status"`; (7) signature present with folder `nordcart/products`; (8) deleted then `"Product not found"`. **DB left clean** (test product removed, order status restored).

---

### Task 2: AdminRoute guard + navbar link + dashboard page

**Files:**
- Create: `client/src/components/layout/AdminRoute.jsx`
- Modify: `client/src/components/layout/Navbar.jsx`
- Create: `client/src/pages/admin/AdminDashboardPage.jsx` + `AdminDashboardPage.module.css`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: AdminRoute**

Create `client/src/components/layout/AdminRoute.jsx`:

```jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

/**
 * Route guard for staff-only pages: ProtectedRoute's logic plus a role
 * check. Non-admins get bounced home (they have no business knowing the
 * admin routes exist). See ProtectedRoute for the exiting-snapshot dance.
 */
export default function AdminRoute({ routesLocation }) {
  const { user, status } = useAuth();
  const liveLocation = useLocation();
  const isExitingSnapshot = routesLocation.pathname !== liveLocation.pathname;

  if (status === 'loading') return <Spinner fullPage />;
  if (status === 'guest') {
    if (isExitingSnapshot) return null;
    return <Navigate to="/login" replace state={{ from: routesLocation.pathname }} />;
  }
  if (user.role !== 'admin') {
    if (isExitingSnapshot) return null;
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 2: Navbar link** — in `client/src/components/layout/Navbar.jsx`, inside the `status === 'authenticated'` branch, add before the profile NavLink:

```jsx
              {user.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                >
                  Admin
                </NavLink>
              )}
```

- [ ] **Step 3: Dashboard page**

Create `client/src/pages/admin/AdminDashboardPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { formatPrice } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import styles from './AdminDashboardPage.module.css';

const STATUS_LABELS = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered' };

export default function AdminDashboardPage() {
  const [state, setState] = useState({ stats: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/stats')
      .then(({ data }) => !cancelled && setState({ stats: data.data, error: null }))
      .catch((err) => !cancelled && setState({ stats: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { stats, error } = state;

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>{error}</h1>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  const tiles = [
    { label: 'Revenue', value: formatPrice(stats.revenue) },
    { label: 'Orders', value: stats.orderCount },
    { label: 'Products', value: stats.productCount },
    { label: 'Users', value: stats.userCount },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Admin</h1>
        <nav className={styles.nav} aria-label="Admin sections">
          <Link to="/admin/products">Products</Link>
          <Link to="/admin/orders">Orders</Link>
        </nav>
      </header>

      <section aria-label="Store totals" className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <p className={styles.tileValue}>{tile.value}</p>
            <p className={styles.tileLabel}>{tile.label}</p>
          </div>
        ))}
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="low-stock-heading">
          <h2 id="low-stock-heading">Low stock</h2>
          {stats.lowStock.length === 0 ? (
            <p className={styles.emptyNote}>Everything is well stocked.</p>
          ) : (
            <ul className={styles.list}>
              {stats.lowStock.map((product) => (
                <li key={product._id} className={styles.listRow}>
                  <Link to={`/products/${product.slug}`}>{product.name}</Link>
                  <span className={product.countInStock === 0 ? styles.out : styles.low}>
                    {product.countInStock === 0 ? 'Out of stock' : `${product.countInStock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-orders-heading">
          <h2 id="recent-orders-heading">Recent orders</h2>
          {stats.recentOrders.length === 0 ? (
            <p className={styles.emptyNote}>No orders yet.</p>
          ) : (
            <ul className={styles.list}>
              {stats.recentOrders.map((order) => (
                <li key={order._id} className={styles.listRow}>
                  <span>
                    {order.user?.name ?? 'Deleted user'} ·{' '}
                    <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('sv-SE')}</time>
                  </span>
                  <span>
                    {STATUS_LABELS[order.status]} · <strong>{formatPrice(order.totalPrice)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Dashboard styles**

Create `client/src/pages/admin/AdminDashboardPage.module.css`:

```css
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.header h1 {
  font-size: 2rem;
}

.nav {
  display: flex;
  gap: var(--space-6);
}

.nav a {
  color: var(--color-accent);
  font-weight: 600;
  transition: color var(--transition-fast);
}

.nav a:hover {
  color: var(--color-accent-strong);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.tile {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.tileValue {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tileLabel {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  align-items: start;
}

.columns h2 {
  font-size: 1.25rem;
  margin-bottom: var(--space-4);
}

.list {
  list-style: none;
  display: grid;
  gap: var(--space-2);
}

.listRow {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: 0.9375rem;
}

.listRow a {
  transition: color var(--transition-fast);
}

.listRow a:hover {
  color: var(--color-accent);
}

.low {
  color: var(--color-warning);
}

.out {
  color: var(--color-danger);
}

.emptyNote {
  color: var(--color-text-muted);
}

.error {
  text-align: center;
  padding-top: var(--space-16);
}

@media (max-width: 860px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Routes** — in `client/src/App.jsx`: `import AdminRoute from './components/layout/AdminRoute';` and `import AdminDashboardPage from './pages/admin/AdminDashboardPage';`, then add a new guard block as a sibling of the ProtectedRoute block (the remaining admin routes land in Tasks 3–4):

```jsx
          <Route element={<AdminRoute routesLocation={location} />}>
            <Route path="/admin" element={page(<AdminDashboardPage />)} />
          </Route>
```

- [ ] **Step 6: Lint + build** — both clean.

---

### Task 3: Admin products — table + create/edit form with Cloudinary upload

**Files:**
- Create: `client/src/pages/admin/AdminProductsPage.jsx` + `AdminProductsPage.module.css`
- Create: `client/src/pages/admin/AdminProductFormPage.jsx` + `AdminProductFormPage.module.css`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Products table page**

Create `client/src/pages/admin/AdminProductsPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import placeholder from '../../assets/placeholder-product.svg';
import styles from './AdminProductsPage.module.css';

export default function AdminProductsPage() {
  const addToast = useToast();
  const [products, setProducts] = useState(null);
  // Two-click delete: first click arms the row, second click commits.
  // (No window.confirm — blocking dialogs are hostile to users and tests.)
  const [armedId, setArmedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // limit=100: the seed has 24 products; pagination inside the admin
    // table is out of scope for this portfolio (documented trade-off).
    api
      .get('/products?limit=100')
      .then(({ data }) => !cancelled && setProducts(data.data.products))
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (product) => {
    if (armedId !== product._id) {
      setArmedId(product._id);
      return;
    }
    setDeletingId(product._id);
    try {
      await api.delete(`/admin/products/${product._id}`);
      setProducts((current) => current.filter((item) => item._id !== product._id));
      addToast(`${product.name} deleted`);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setDeletingId(null);
      setArmedId(null);
    }
  };

  if (products === null) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Products <span>({products.length})</span></h1>
        <Link to="/admin/products/new" className={styles.newButton}>
          + New product
        </Link>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Featured</th>
              <th scope="col"><span className={styles.srOnly}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id}>
                <td>
                  <div className={styles.productCell}>
                    <img
                      src={product.images[0]?.url ?? placeholder}
                      alt=""
                      onError={(e) => (e.currentTarget.src = placeholder)}
                    />
                    <span>{product.name}</span>
                  </div>
                </td>
                <td>{product.category}</td>
                <td className={styles.num}>{formatPrice(product.price)}</td>
                <td className={`${styles.num} ${product.countInStock <= 5 ? styles.low : ''}`.trim()}>
                  {product.countInStock}
                </td>
                <td>{product.isFeatured ? '★' : ''}</td>
                <td>
                  <div className={styles.actions}>
                    <Link to={`/admin/products/${product._id}/edit`} className={styles.edit}>
                      Edit
                    </Link>
                    <button
                      className={armedId === product._id ? styles.confirmDelete : styles.delete}
                      onClick={() => handleDelete(product)}
                      onBlur={() => setArmedId((id) => (id === product._id ? null : id))}
                      disabled={deletingId === product._id}
                    >
                      {armedId === product._id ? 'Confirm?' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Table styles**

Create `client/src/pages/admin/AdminProductsPage.module.css`:

```css
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.header h1 {
  font-size: 2rem;
}

.header h1 span {
  color: var(--color-text-muted);
  font-size: 1.125rem;
  font-weight: 400;
  font-family: var(--font-body);
}

.newButton {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: background-color var(--transition-fast);
}

.newButton:hover {
  background: var(--color-accent-strong);
}

.tableWrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.table th,
.table td {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.table thead th {
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:hover {
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
}

.productCell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.productCell img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
}

.num {
  font-variant-numeric: tabular-nums;
}

.low {
  color: var(--color-warning);
}

.actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

.edit {
  color: var(--color-accent);
}

.delete {
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.delete:hover {
  color: var(--color-danger);
}

.confirmDelete {
  color: var(--color-danger);
  font-weight: 600;
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
```

- [ ] **Step 3: Product form page (create + edit + upload)**

Create `client/src/pages/admin/AdminProductFormPage.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import styles from './AdminProductFormPage.module.css';

const CATEGORIES = ['audio', 'keyboards', 'smart-home', 'desk', 'wearables', 'accessories'];

const EMPTY_FORM = {
  name: '',
  brand: '',
  category: 'audio',
  price: '', // whole kronor in the UI; öre on the wire
  countInStock: '',
  description: '',
  isFeatured: false,
};

/** Upload one file straight to Cloudinary using a server-issued signature. */
async function uploadToCloudinary(file) {
  const { data } = await api.post('/admin/uploads/signature');
  const { timestamp, signature, apiKey, cloudName, folder } = data.data;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', timestamp);
  body.append('signature', signature);
  body.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
  const uploaded = await res.json();
  if (!res.ok) throw new Error(uploaded.error?.message ?? 'Upload failed');
  return uploaded.secure_url;
}

export default function AdminProductFormPage() {
  const { id } = useParams(); // present → edit mode
  const navigate = useNavigate();
  const addToast = useToast();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState([]); // [{ url, alt }]
  const [loading, setLoading] = useState(Boolean(id));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    api
      .get(`/admin/products/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        const product = data.data.product;
        setForm({
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: String(product.price / 100), // öre → kronor for editing
          countInStock: String(product.countInStock),
          description: product.description,
          isFeatured: product.isFeatured,
        });
        setImages(product.images);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        addToast(getErrorMessage(err), 'error');
        navigate('/admin/products', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, addToast, navigate]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      // Alt defaults to the product name; editable per image below.
      setImages((current) => [...current, { url, alt: form.name || 'Product photo' }]);
      addToast('Image uploaded');
    } catch (err) {
      addToast(getErrorMessage(err) === 'Something went wrong — please try again' ? err.message : getErrorMessage(err), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAlt = (index) => (e) =>
    setImages((current) => current.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)));

  const removeImage = (index) => setImages((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      addToast('Add at least one image', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      price: Math.round(Number(form.price) * 100), // kronor → integer öre
      countInStock: Number(form.countInStock),
      description: form.description,
      isFeatured: form.isFeatured,
      images,
    };
    try {
      const { data } = id
        ? await api.put(`/admin/products/${id}`, payload)
        : await api.post('/admin/products', payload);
      addToast(data.message);
      navigate('/admin/products');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{id ? 'Edit product' : 'New product'}</h1>
        <Link to="/admin/products" className={styles.backLink}>← All products</Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <Input id="name" label="Name" value={form.name} onChange={setField('name')} required minLength={2} maxLength={120} />
          <Input id="brand" label="Brand" value={form.brand} onChange={setField('brand')} required maxLength={60} />

          <div className={styles.field}>
            <label htmlFor="category" className={styles.selectLabel}>Category</label>
            <select id="category" className={styles.select} value={form.category} onChange={setField('category')}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <Input id="price" label="Price (kr)" type="number" min="0" step="1" value={form.price} onChange={setField('price')} required />
            <Input id="countInStock" label="Stock" type="number" min="0" step="1" value={form.countInStock} onChange={setField('countInStock')} required />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.selectLabel}>Description</label>
          <textarea
            id="description"
            className={styles.textarea}
            value={form.description}
            onChange={setField('description')}
            required
            minLength={2}
            maxLength={2000}
            rows={5}
          />
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
          />
          Featured on the homepage
        </label>

        <section aria-labelledby="images-heading" className={styles.imagesSection}>
          <h2 id="images-heading">Images</h2>
          <ul className={styles.imageList}>
            {images.map((image, index) => (
              <li key={image.url} className={styles.imageRow}>
                <img src={image.url} alt="" />
                <Input
                  id={`alt-${index}`}
                  label="Alt text"
                  value={image.alt}
                  onChange={setAlt(index)}
                  required
                  minLength={2}
                  maxLength={200}
                />
                <button type="button" className={styles.removeImage} onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <label className={styles.uploadButton}>
            {uploading ? 'Uploading…' : '+ Upload image'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className={styles.fileInput}
            />
          </label>
        </section>

        <Button type="submit" isLoading={saving} disabled={uploading}>
          {id ? 'Save changes' : 'Create product'}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Form styles**

Create `client/src/pages/admin/AdminProductFormPage.module.css`:

```css
.page {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.header h1 {
  font-size: 2rem;
}

.backLink {
  color: var(--color-accent);
}

.form {
  display: grid;
  gap: var(--space-6);
}

.grid {
  display: grid;
  gap: var(--space-4);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field {
  display: grid;
  gap: var(--space-2);
}

.selectLabel {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.select,
.textarea {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  transition: border-color var(--transition-fast);
}

.select:focus,
.textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.textarea {
  resize: vertical;
  min-height: 120px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  color: var(--color-text-muted);
}

.checkbox input {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
}

.imagesSection h2 {
  font-size: 1.125rem;
  margin-bottom: var(--space-3);
}

.imageList {
  list-style: none;
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.imageRow {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  gap: var(--space-4);
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.imageRow img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
}

.removeImage {
  font-size: 1.25rem;
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2);
  transition: color var(--transition-fast);
}

.removeImage:hover {
  color: var(--color-danger);
}

.uploadButton {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.uploadButton:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.fileInput {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

@media (max-width: 640px) {
  .row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Routes** — in `client/src/App.jsx`, import both pages and extend the AdminRoute block:

```jsx
            <Route path="/admin/products" element={page(<AdminProductsPage />)} />
            <Route path="/admin/products/new" element={page(<AdminProductFormPage />)} />
            <Route path="/admin/products/:id/edit" element={page(<AdminProductFormPage />)} />
```

- [ ] **Step 6: Lint + build** — both clean.

---

### Task 4: Admin orders page

**Files:**
- Create: `client/src/pages/admin/AdminOrdersPage.jsx` + `AdminOrdersPage.module.css`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Orders page**

Create `client/src/pages/admin/AdminOrdersPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import styles from './AdminOrdersPage.module.css';

const STATUSES = ['pending', 'shipped', 'delivered'];

export default function AdminOrdersPage() {
  const addToast = useToast();
  const [orders, setOrders] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/orders')
      .then(({ data }) => !cancelled && setOrders(data.data.orders))
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = (order) => async (e) => {
    const status = e.target.value;
    setSavingId(order._id);
    try {
      const { data } = await api.put(`/admin/orders/${order._id}/status`, { status });
      setOrders((current) => current.map((item) => (item._id === order._id ? { ...item, status: data.data.order.status } : item)));
      addToast(data.message);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (orders === null) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Orders <span>({orders.length})</span></h1>
        <Link to="/admin" className={styles.backLink}>← Dashboard</Link>
      </header>

      {orders.length === 0 ? (
        <p className={styles.emptyNote}>No orders yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Placed</th>
                <th scope="col">Customer</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Paid</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order._id}>
                    <td>
                      {/* Admin can open the order detail: getOrderById allows admins */}
                      <Link to={`/orders/${order._id}`} className={styles.orderLink}>
                        {new Date(order.createdAt).toLocaleDateString('sv-SE')}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.customer}>
                        {order.user?.name ?? 'Deleted user'}
                        <span className={styles.email}>{order.user?.email}</span>
                      </span>
                    </td>
                    <td className={styles.num}>{itemCount}</td>
                    <td className={styles.num}>{formatPrice(order.totalPrice)}</td>
                    <td>{order.isPaid ? '✓' : '—'}</td>
                    <td>
                      <select
                        className={styles.status}
                        value={order.status}
                        onChange={handleStatusChange(order)}
                        disabled={savingId === order._id}
                        aria-label={`Status of order placed ${new Date(order.createdAt).toLocaleDateString('sv-SE')} by ${order.user?.name ?? 'deleted user'}`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Orders styles**

Create `client/src/pages/admin/AdminOrdersPage.module.css`:

```css
.page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-16);
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.header h1 {
  font-size: 2rem;
}

.header h1 span {
  color: var(--color-text-muted);
  font-size: 1.125rem;
  font-weight: 400;
  font-family: var(--font-body);
}

.backLink {
  color: var(--color-accent);
}

.emptyNote {
  color: var(--color-text-muted);
}

.tableWrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.table th,
.table td {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.table thead th {
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.orderLink {
  color: var(--color-accent);
}

.customer {
  display: grid;
}

.email {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.num {
  font-variant-numeric: tabular-nums;
}

.status {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  transition: border-color var(--transition-fast);
}

.status:focus {
  outline: none;
  border-color: var(--color-accent);
}

.status:disabled {
  opacity: 0.5;
}
```

- [ ] **Step 3: Route** — in `client/src/App.jsx`, import `AdminOrdersPage` and add inside the AdminRoute block:

```jsx
            <Route path="/admin/orders" element={page(<AdminOrdersPage />)} />
```

- [ ] **Step 4: Lint + build** — both clean.

---

### Task 5: Final verification + phase commit

- [ ] **Step 1:** `npm run lint` (root) exit 0; `npm run build --prefix client` success.
- [ ] **Step 2:** Re-run Task 1's curl block end-to-end; all expectations hold; DB clean afterwards.
- [ ] **Step 3: Cloudinary re-check** — run the ping from the Prerequisites; if `{"status":"ok"}`, proceed to full upload verification in Step 4; if still mismatched, escalate to the user before committing.
- [ ] **Step 4: Browser flows** (window visible or DOM/API assertions):
1. demo (non-admin): no "Admin" navbar link; direct `/admin` visit bounces home. Guest → `/login`.
2. admin: "Admin" link appears; dashboard shows revenue/orders/products/users tiles matching the curl stats, low-stock list, recent orders.
3. Products: table lists all 24; create a product via the form **with a real file upload** (any small image) → appears in the table and on the public catalog; edit it (rename → new slug, change price) → catalog reflects it; delete it (two-click confirm) → gone from table and catalog.
4. Orders: table lists all orders with customer names/emails; change a status pending→shipped → toast + persists on reload; date links open the order detail page (admin path of getOrderById); restore the status to its original value afterwards.
- [ ] **Step 5:** `git status` / `git diff --stat` matches the plan's File Structure (+ plan doc). Commit + push:

```bash
git add -A
git commit -m "Phase 7: admin dashboard — stats, product CRUD with Cloudinary uploads, order management"
git push
```

(No attribution trailers; push pre-authorized per phase.)

---

## Execution deviations (2026-07-04)

Review-driven changes:

1. `adminController.js` `updateProduct`: `isFeatured` defaults to the product's current value when omitted — `set({ isFeatured: undefined })` would silently UNSET the flag on save (real API defect; unreachable via the shipped UI but wrong for any other caller).
2. Upload signature now also signs `allowed_formats: 'jpg,jpeg,png,webp,avif'` (client sends it verbatim in the FormData) — an unpinned signature could be replayed against `/raw/upload` to push arbitrary file types.
3. `AdminProductFormPage` upload catch routes errors on `err.response` presence instead of comparing against axios.js's fallback message string (magic-string coupling).
4. Removed stale `.gitkeep` files from now-populated dirs (`pages/admin`, `components/cart`, `hooks`).

Accepted minors (flagged, deliberate): two-click delete's click-away disarm doesn't fire on Safari (buttons don't take focus there; delete flow itself unaffected); `Number('')` coercion in the form is backstopped by native `required` + server validators; `components/admin` and `components/checkout` remain empty scaffolding dirs (Phase 8 cleanup candidate).

## Self-review notes

- **Spec coverage:** design doc Phase 7 = "Admin dashboard"; decisions honored: Cloudinary for admin image uploads (signed direct upload; `config/cloudinary.js` from Phase 1 finally consumed), `authorize('admin')` middleware (Phase 2) finally consumed, REST envelope/validators, order status enum from the Order model, denormalized-safe product updates via set+save (slug hook).
- **Type consistency:** stats keys (`revenue, orderCount, productCount, userCount, lowStock, recentOrders`) match dashboard consumers; admin orders select list includes everything AdminOrdersPage renders (`orderItems` for count, user name/email, totalPrice, isPaid, status, createdAt); form payload matches `productRules` (price/countInStock integers, images [{url, alt}]); `AdminRoute` consumes `user.role` from the serialized auth user (present since Phase 2).
- **Known trade-offs (deliberate):** admin product table fetches `?limit=100` and paginates nothing (24 seed products); no order-detail admin page (reuses the customer OrderPage — `getOrderById` admits admins); deleting a product leaves its Cloudinary asset (no destroy call — portfolio scope); upload signature is one-per-file (fine at this scale); no user management (not in the design doc); `images.*.url` validator requires https (Cloudinary and Unsplash both are).
