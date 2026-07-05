# Phase 8 — Polish, README & Deployment Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the deferred animation/UX debt, tighten a11y + mobile responsiveness, and ship the real README plus a Vercel + Render + Atlas deployment guide — the final phase of `docs/specs/2026-07-02-nordcart-design.md`.

**Architecture:** Three small code workstreams (cart exit-animation debt from Phases 4–6 reviews, live profile counters, a11y/titles/responsive CSS) plus two documentation deliverables (README rewrite, `docs/DEPLOYMENT.md` + `client/vercel.json` for SPA rewrites). No new dependencies, no schema or API changes.

**Tech Stack:** existing conventions only.

**Testing & commit conventions:** as prior phases — no test framework (browser/DOM verification with exact assertions), single phase commit (`Phase 8: …`, NO attribution trailers), push after.

**Environment:** API :5001, client :5173, demo/admin seed accounts. Browser gotcha: hidden tab freezes AnimatePresence — for the cart-exit verification the window MUST be visible (that's literally what's being tested); ask the user to surface it if needed.

---

## File Structure

**Task 1 (cart animation debt + live counters + dead dirs):**
- Modify: `client/src/pages/CartPage.jsx` — deferred empty-state swap via `AnimatePresence onExitComplete`; `safely()` returns success boolean.
- Modify: `client/src/components/cart/CartItemRow.jsx` — remove keeps the row disabled through its exit animation (re-enables only on failure).
- Modify: `client/src/pages/ProfilePage.jsx` — stats read live `useCart().itemCount` / `useWishlist().count` instead of the stale login-time user snapshot.
- Delete: `client/src/components/admin/.gitkeep`, `client/src/components/checkout/.gitkeep` (empty scaffolding dirs that never got tenants).

**Task 2 (a11y + titles + responsive navbar):**
- Create: `client/src/hooks/usePageTitle.js`.
- Modify: every page component (list in the task) — one `usePageTitle('…')` call each.
- Modify: `client/src/App.jsx` — skip-to-content link + `#main-content` landmark wrapper.
- Modify: `client/src/styles/global.css` — `.skip-link` styles.
- Modify: `client/src/components/layout/Navbar.module.css` — mobile compaction media queries.

**Task 3 (docs):**
- Rewrite: `README.md`.
- Create: `docs/DEPLOYMENT.md`.
- Create: `client/vercel.json`.

---

### Task 1: Cart animation debt + live profile counters

**Files:** as listed above.

- [ ] **Step 1: CartPage — defer the empty state until the last row's exit completes**

In `client/src/pages/CartPage.jsx`, add `useState` to the react import, then replace the loading/empty/return structure with:

```jsx
export default function CartPage() {
  usePageTitle('Your cart'); // added in Task 2 — if Task 2 hasn't run yet, omit this line and Task 2 adds it
  const { items, status, itemCount, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const addToast = useToast();

  // Deferred empty state: when the last row is removed, keep the (empty)
  // list mounted until AnimatePresence finishes the exit animation, then
  // swap — otherwise the empty state pops in over the exiting row
  // (deferred from the Phase 4 review to this phase).
  const hasItems = items.length > 0;
  const [exitDone, setExitDone] = useState(true);
  const [prevHasItems, setPrevHasItems] = useState(hasItems);
  if (prevHasItems !== hasItems) {
    // Render-time adjustment (same pattern as ProductPage's slug reset).
    setPrevHasItems(hasItems);
    if (!hasItems) setExitDone(false);
  }

  // Context actions throw on network errors — surface them, never crash.
  // Returns false on failure so rows know whether to re-enable themselves.
  const safely = (action) => async (...args) => {
    try {
      await action(...args);
      return true;
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
      return false;
    }
  };

  if (status === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner />
      </main>
    );
  }

  if (!hasItems && exitDone) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>Your cart is empty</h1>
        <p>Find something you like in the shop — it will show up here.</p>
        <Link to="/products" className={styles.browse}>
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        Your cart <span>({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
      </h1>

      <div className={styles.layout}>
        <ul className={styles.list}>
          <AnimatePresence initial={false} onExitComplete={() => setExitDone(true)}>
            {items.map((item) => (
              <CartItemRow
                key={item.product._id}
                item={item}
                onQuantityChange={safely(updateQuantity)}
                onRemove={safely(removeItem)}
              />
            ))}
          </AnimatePresence>
        </ul>

        <aside className={styles.summary} aria-label="Order summary">
          {/* …summary unchanged… */}
        </aside>
      </div>
    </main>
  );
}
```

Keep the summary JSX exactly as it is today (subtotal, shipping line, checkout button, clear button — all unchanged). The only structural changes: the `safely` return values, the `exitDone` gate on the empty state, and `onExitComplete` on AnimatePresence.

- [ ] **Step 2: CartItemRow — stay disabled through the exit animation**

In `client/src/components/cart/CartItemRow.jsx`, replace the `run` helper and the remove button's handler:

```jsx
  const [busy, setBusy] = useState(false);

  // Serialize this row's mutations: rapid +/− clicks would otherwise race,
  // each sending the same absolute quantity computed from stale props.
  // Handlers resolve to false on failure (CartPage's safely()).
  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  // A successful remove unmounts this row — leaving it disabled prevents
  // ghost clicks during the exit animation. Re-enable only on failure
  // (deferred from the Phase 6 review to this phase).
  const handleRemove = async () => {
    setBusy(true);
    const ok = await onRemove(product._id);
    if (ok === false) setBusy(false);
  };
```

and change the remove button to `onClick={handleRemove}` (keep `disabled={busy}`). The +/− buttons keep using `run(() => onQuantityChange(...))` unchanged.

- [ ] **Step 3: ProfilePage — live counters**

In `client/src/pages/ProfilePage.jsx`: add imports `import { useCart } from '../context/CartContext';` and `import { useWishlist } from '../context/WishlistContext';`, inside the component add `const { itemCount } = useCart();` and `const { count: wishlistCount } = useWishlist();`, and change the stats `dd`s: cart → `{itemCount}`, wishlist → `{wishlistCount}` (they currently read the stale `user.cart.length` / `user.wishlist.length` snapshot from login time).

- [ ] **Step 4: Remove dead scaffolding** — `git rm client/src/components/admin/.gitkeep client/src/components/checkout/.gitkeep` (the dirs vanish with their only file; nothing imports from them — verify with `grep -r "components/admin\|components/checkout" client/src`).

- [ ] **Step 5: Lint + build** — `npm run lint --prefix client` exit 0, `npm run build --prefix client` success.

---

### Task 2: A11y, page titles, responsive navbar

- [ ] **Step 1: usePageTitle hook**

Create `client/src/hooks/usePageTitle.js`:

```js
import { useEffect } from 'react';

const BASE_TITLE = 'NordCart — Nordic Tech & Audio';

/**
 * Per-route document titles (screen readers announce them on navigation;
 * tabs become distinguishable). Falsy titles fall back to the base title,
 * which also comes back on unmount.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · NordCart` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
```

- [ ] **Step 2: Apply titles** — add `import usePageTitle from '../hooks/usePageTitle';` (adjust the relative path for admin pages: `'../../hooks/usePageTitle'`) and one call at the top of each component:

| Page file | Call |
| --- | --- |
| `CatalogPage.jsx` | `usePageTitle('Shop')` |
| `ProductPage.jsx` | `usePageTitle(product?.name)` (place after the `data` state exists; falsy while loading → base title) |
| `CartPage.jsx` | `usePageTitle('Your cart')` |
| `CheckoutPage.jsx` | `usePageTitle('Checkout')` (in the outer `CheckoutPage` component) |
| `OrdersPage.jsx` | `usePageTitle('Your orders')` |
| `OrderPage.jsx` | `usePageTitle('Order details')` |
| `WishlistPage.jsx` | `usePageTitle('Wishlist')` |
| `LoginPage.jsx` | `usePageTitle('Log in')` |
| `RegisterPage.jsx` | `usePageTitle('Create account')` |
| `ProfilePage.jsx` | `usePageTitle('Profile')` |
| `NotFoundPage.jsx` | `usePageTitle('Page not found')` |
| `admin/AdminDashboardPage.jsx` | `usePageTitle('Admin')` |
| `admin/AdminProductsPage.jsx` | `usePageTitle('Products · Admin')` |
| `admin/AdminProductFormPage.jsx` | `usePageTitle(id ? 'Edit product · Admin' : 'New product · Admin')` |
| `admin/AdminOrdersPage.jsx` | `usePageTitle('Orders · Admin')` |

(HomePage keeps the base title — no call.) Hook calls must be unconditional and before any early returns (hooks rules).

- [ ] **Step 3: Skip link + landmark**

In `client/src/App.jsx`, add the link as the first child and wrap the AnimatePresence in the landmark target:

```jsx
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <div id="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait">
          {/* …Routes unchanged… */}
        </AnimatePresence>
      </div>
    </>
```

Append to `client/src/styles/global.css` (global utility — this file is the one non-module stylesheet):

```css
/* --- Skip link: invisible until keyboard-focused --- */
.skip-link {
  position: fixed;
  top: 0;
  left: -100vw;
  z-index: 200;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  padding: var(--space-2) var(--space-4);
  border-radius: 0 0 var(--radius-md) 0;
  font-weight: 600;
}

.skip-link:focus {
  left: 0;
}
```

- [ ] **Step 4: Navbar mobile compaction**

Append to `client/src/components/layout/Navbar.module.css`:

```css
@media (max-width: 640px) {
  .nav {
    padding: var(--space-3) var(--space-4);
  }

  .brand {
    font-size: 1.125rem;
  }

  .links {
    gap: var(--space-4);
    font-size: 0.875rem;
  }
}

@media (max-width: 400px) {
  .links {
    gap: var(--space-3);
  }
}
```

- [ ] **Step 5: Lint + build** — both clean.

---

### Task 3: README rewrite + deployment guide + vercel.json

- [ ] **Step 1: Rewrite `README.md`** with exactly:

```markdown
# NordCart 🛒

A modern, fully animated e-commerce storefront for Nordic-designed tech & audio gear — built end-to-end as a full-stack portfolio project.

**React 18 · Express 5 · MongoDB Atlas · Stripe · Cloudinary**

## Features

- **Catalog** — search-as-you-type, category & price filtering, sorting, pagination, product detail pages with cursor-following image zoom
- **Cart** — guest cart in localStorage that merges into the account on login; quantity clamping against live stock; optimistic-feeling UI backed by server truth
- **Checkout** — Stripe PaymentElement (test mode) with server-side pricing; orders are created inside a MongoDB transaction (order + stock decrement + cart clear land atomically) and are idempotent on the payment id
- **Orders** — snapshot-based order history (renames/repricing never rewrite the past), per-user history and detail pages
- **Reviews** — verified purchasers only (a paid order must contain the product), one review per user per product, denormalized product ratings recalculated on every write
- **Wishlist** — heart toggles everywhere, dedicated wishlist page
- **Admin** — dashboard (revenue/orders/stock), product CRUD with **signed direct-to-Cloudinary image uploads** (file bytes never touch the API), order status management
- **Polish** — Framer Motion page transitions & micro-interactions honoring `prefers-reduced-motion`, dark Nordic design system on CSS variables, skip-link + semantic landmarks, per-route document titles, responsive layouts

## Tech stack

| Layer     | Choices                                                                 |
| --------- | ----------------------------------------------------------------------- |
| Frontend  | React 18 (Vite), React Router v6, Context API + useReducer, Axios, Framer Motion, CSS Modules |
| Backend   | Node.js, Express 5, JWT auth (httpOnly cookies), bcrypt, express-validator |
| Database  | MongoDB Atlas + Mongoose 9 (multi-document transactions at checkout)     |
| Payments  | Stripe PaymentIntents (test mode)                                        |
| Images    | Cloudinary (signed direct uploads from the admin dashboard)              |

## Getting started

```bash
# 1. Install everything (root, server, client)
npm install && npm install --prefix server && npm install --prefix client

# 2. Configure the server
cp server/.env.example server/.env
#    → fill in MONGO_URI (Atlas), JWT_SECRET, STRIPE_SECRET_KEY (sk_test_…),
#      CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET

# 3. Configure the client
cp client/.env.example client/.env
#    → fill in VITE_STRIPE_PUBLISHABLE_KEY (pk_test_…)

# 4. Seed the database (24 products + admin & demo accounts)
npm run seed

# 5. Run API (:5001) and storefront (:5173) together
npm run dev
```

> **Note:** the checkout transaction requires a replica-set MongoDB — Atlas works out of the box; a plain local `mongod` will not.

**Seed accounts:** `admin@nordcart.se` / `Admin1234!` · `demo@nordcart.se` / `Demo1234!`
(override with `ADMIN_SEED_PASSWORD` / `DEMO_SEED_PASSWORD` before seeding a public deployment)

**Stripe test card:** `4242 4242 4242 4242` (any future expiry, any CVC) · decline: `4000 0000 0000 0002`

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + storefront together (concurrently) |
| `npm run seed` | Reset & seed products + users |
| `npm run seed:destroy` | Wipe seeded data |
| `npm run lint` | ESLint over both workspaces |

## Project structure

Monorepo: `server/` (REST API under `/api/v1/` — routes → controllers → models, central error handler, `{ success, message, data }` envelope) and `client/` (Vite app — pages, components, contexts for auth/cart/wishlist/toasts).

- Architecture & schema decisions: [`docs/specs/2026-07-02-nordcart-design.md`](docs/specs/2026-07-02-nordcart-design.md)
- Per-phase implementation plans (with review-driven deviation logs): [`docs/superpowers/plans/`](docs/superpowers/plans/)
- **Deployment guide (Vercel + Render + Atlas): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**
```

- [ ] **Step 2: Create `client/vercel.json`** (SPA fallback — deep links like `/products/x` must serve index.html):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 3: Create `docs/DEPLOYMENT.md`** with exactly:

```markdown
# Deploying NordCart — Vercel + Render + MongoDB Atlas

The storefront (Vite build) goes to **Vercel**, the API to **Render**, the database to **MongoDB Atlas**. All three have free tiers that fit this project.

## 1. MongoDB Atlas

1. Create a free (M0) cluster and a database user (Database Access → Add user, password auth).
2. **Network Access → Add IP → `0.0.0.0/0`** ("allow from anywhere"). Render's free-tier egress IPs rotate, and so do most home ISP addresses — single-IP allowlists break both local dev and the deployed API. Credentials still gate access.
3. Copy the connection string (Database → Connect → Drivers) — it becomes `MONGO_URI`.
4. The checkout flow uses multi-document transactions, which need a replica set: **Atlas clusters always are one** — nothing to configure. (A local standalone `mongod` cannot run checkout.)

## 2. API on Render

Create a **Web Service** from this repo:

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` (switches cookies to `Secure` + `SameSite=None` for the cross-site client) |
| `MONGO_URI` | the Atlas connection string |
| `JWT_SECRET` | long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | your Vercel URL (e.g. `https://nordcart.vercel.app`) — CORS allows exactly this origin |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from the Cloudinary dashboard (the cloud name is the segment after `@` in `CLOUDINARY_URL`) |

Notes already handled in code: `trust proxy` is set (rate limiting keys on real client IPs behind Render's proxy), and the health endpoint doubles as a keep-awake ping target for free-tier spin-down.

## 3. Seed the production database

Run locally against the production connection string (mind the shell history — or export the vars):

```bash
MONGO_URI='<atlas-uri>' ADMIN_SEED_PASSWORD='<strong>' DEMO_SEED_PASSWORD='<strong>' npm run seed
```

Never ship the default seed passwords to a public deployment.

## 4. Storefront on Vercel

Import the repo as a new project:

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Framework preset | Vite |

Environment variables:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<your-render-service>.onrender.com/api/v1` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |

`client/vercel.json` (already in the repo) rewrites every path to `index.html` so deep links into the SPA work.

## 5. Post-deploy checklist

- [ ] `https://<render>/api/v1/health` returns `{ "success": true, … }`
- [ ] Register/login works on the Vercel site and **survives a hard refresh** (if not: `CLIENT_URL` mismatch or `NODE_ENV` ≠ production — the cookie needs `SameSite=None; Secure` cross-site)
- [ ] Checkout with `4242 4242 4242 4242` completes and the order appears under `/orders`
- [ ] Admin login → product image upload works (Cloudinary vars)
- [ ] First request after idle takes ~30–60 s: Render free tier spins down; the health-check ping or an external uptime pinger mitigates it
```

- [ ] **Step 4:** Nothing to lint (docs), but run `npm run build --prefix client` once to confirm `vercel.json` didn't confuse Vite (it won't — it's not part of the build).

---

### Task 4: Final verification + phase commit

- [ ] **Step 1:** `npm run lint` (root) exit 0; `npm run build --prefix client` success.
- [ ] **Step 2: Browser verification** (window **visible** — the cart exit animation is the test subject):
1. Cart: add one product → `/cart` → remove the row → the row animates out fully, THEN the empty state appears (no pop-in). Add two products → "Clear cart" → both animate out, then empty state.
2. During a row's exit animation, its buttons stay disabled (no ghost clicks).
3. Profile: add 2 items to cart + 1 wishlist heart → `/profile` shows Cart items 2 / Wishlist 1 live (no re-login needed); remove them → counters drop.
4. Titles: navigate Shop → a product → cart → checkout → orders → admin; `document.title` changes per route (assert via JS).
5. Skip link: on any page, press Tab once → "Skip to content" appears top-left; Enter moves focus to the content landmark.
6. Mobile: resize window to 375×700 → navbar fits on one line for admin (worst case: brand + Shop + cart + Admin + name + Logout), catalog/cart/checkout render without horizontal scroll.
7. Cleanup: empty the demo cart/wishlist.
- [ ] **Step 3:** README renders correctly (`git diff --stat`; view the markdown); DEPLOYMENT.md links resolve.
- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "Phase 8: polish — cart exit animations, live profile stats, a11y (skip link, titles), responsive navbar, README + deployment guide"
git push
```

---

## Self-review notes

- **Spec coverage:** design doc Phase 8 = "Polish: animations, responsiveness, a11y, README, deployment guide (Vercel + Render + Atlas)" — animations (Task 1 closes the two deferred cart nits), responsiveness (navbar compaction + 375px pass), a11y (skip link, landmark, per-route titles, existing reduced-motion/focus conventions), README (Task 3), deployment guide (Task 3, incl. the SPA rewrite file). Backlog items from earlier phase reviews all addressed or consciously retained.
- **Type consistency:** `safely()` now returns a boolean — CartItemRow's `handleRemove` checks `=== false`; quantity handlers ignore the return (unchanged behavior). `usePageTitle` signature used identically in 15 call sites.
- **Known trade-offs:** no hamburger menu (compaction suffices at 375px for this link count); summary aside stays visible during the last row's exit (sub-second, with zeroed totals — acceptable); HomePage keeps the base title by design.
