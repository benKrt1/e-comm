# NordCart 🛒

A modern, fully animated e-commerce app for Nordic-designed tech & audio gear — built end-to-end as a full-stack portfolio project.

**Next.js 16 (TypeScript) frontend · Express 5 (TypeScript) REST API · MongoDB Atlas + Mongoose 9 · JWT auth · Stripe · Cloudinary**

## Architecture

Two-tier, two deployables:

- **`server/`** — Express 5 REST API (TypeScript, run with `tsx`). Owns all data, auth, pricing, Stripe and Cloudinary logic. Mongoose 9 over MongoDB Atlas. **JWT in an httpOnly cookie**, plus `express-rate-limit`, `express-validator`, CORS-with-credentials and a central error handler. Serves `/api/v1/*`.
- **`web/`** — Next.js 16 frontend (TypeScript, client-rendered). No database access — it talks to the API through a shared **axios** layer (`withCredentials`), with React Contexts for auth/cart/wishlist. In dev, `next.config.ts` rewrites `/api` → the Express server so the browser stays same-origin (the JWT cookie needs no cross-site config locally).

## Features

- **Catalog** — search-as-you-type, category & price filtering, sorting, pagination, product detail with cursor-following image zoom; filter state lives in the URL
- **Cart** — guest cart in localStorage that merges into the account on login; quantity clamping against live stock
- **Checkout** — Stripe PaymentElement (test mode) with server-side pricing; orders are created inside a MongoDB transaction (order + stock decrement + cart clear land atomically) and are idempotent on the payment id
- **Orders** — snapshot-based history (renames/repricing never rewrite the past), per-user history & detail
- **Reviews** — verified purchasers only, one review per user per product, denormalized product ratings recalculated on every write
- **Wishlist** — heart toggles everywhere, dedicated page
- **Admin** — dashboard (revenue/orders/stock), product CRUD with **signed direct-to-Cloudinary uploads** (file bytes never touch the API), order status management, role-guarded
- **Auth & security** — bcrypt password hashing, JWT httpOnly cookie (XSS-safe), rate-limited credential endpoints, request validation, generic auth errors (no email enumeration)

## Getting started

```bash
# 1. Install both apps
npm install --prefix server && npm install --prefix web && npm install

# 2. Configure the API
cp server/.env.example server/.env
#    → MONGO_URI (Atlas), JWT_SECRET, STRIPE_SECRET_KEY (sk_test_…),
#      CLOUDINARY_CLOUD_NAME/_API_KEY/_API_SECRET, CLIENT_URL=http://localhost:3000

# 3. Configure the frontend
cp web/.env.example web/.env.local
#    → NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_…)

# 4. Seed the database (24 products + admin & demo accounts)
npm run seed

# 5. Run the API (:5001) and frontend (:3000) together
npm run dev
```

> **Note:** the checkout transaction requires a replica-set MongoDB — Atlas works out of the box; a plain local `mongod` will not.

**Seed accounts:** `admin@nordcart.se` / `Admin1234!` · `demo@nordcart.se` / `Demo1234!`
(override with `ADMIN_SEED_PASSWORD` / `DEMO_SEED_PASSWORD` before seeding a public deployment)

**Stripe test card:** `4242 4242 4242 4242` (any future expiry, any CVC) · decline: `4000 0000 0000 0002`

## Scripts (repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | API (:5001) + frontend (:3000) together (concurrently) |
| `npm run build` | Production build of the frontend |
| `npm run seed` / `seed:destroy` | Reset & seed / wipe (runs against the API's DB) |
| `npm run lint` | ESLint over both apps |

Per-app: `npm run dev --prefix server` (API, tsx watch) · `npm run typecheck --prefix server` · `npm run dev --prefix web`.

## Project structure

- **`server/`** — `models/` (User with embedded cart/wishlist, Product, Order, Review), `controllers/`, `routes/` (`/api/v1/*`), `middleware/` (auth/JWT, rate limiter, validator, error handler), `config/` (db, stripe, cloudinary), `utils/` (sendToken, ApiError, queryFeatures), `seed/`.
- **`web/`** — `app/` (App Router routes, all client-rendered), `context/AuthContext`, `components/providers/` (cart/wishlist/toast), `components/` (products, reviews, admin, layout, ui), `lib/api.ts` (axios).

Docs: architecture & schema — [`docs/specs/2026-07-02-nordcart-design.md`](docs/specs/2026-07-02-nordcart-design.md) · **deployment — [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**
