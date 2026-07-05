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
