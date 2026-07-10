# NordCart 🛒

A modern, fully animated e-commerce storefront for Nordic-designed tech & audio gear — built end-to-end as a full-stack portfolio project.

**Next.js 16 (App Router) · React 19 · Auth.js · MongoDB Atlas · Stripe · Cloudinary · TypeScript**

## Features

- **Catalog** — server-rendered pages (great SEO + `generateMetadata`), search-as-you-type, category & price filtering, sorting, pagination, product detail with cursor-following image zoom; all filter state lives in the URL
- **Cart** — guest cart in localStorage that merges into the account on login; quantity clamping against live stock; server actions back the account cart
- **Checkout** — Stripe PaymentElement (test mode) with server-side pricing; orders are created inside a MongoDB transaction (order + stock decrement + cart clear land atomically) and are idempotent on the payment id
- **Orders** — snapshot-based order history (renames/repricing never rewrite the past), per-user history and detail pages
- **Reviews** — verified purchasers only (a paid order must contain the product), one review per user per product, denormalized product ratings recalculated on every write
- **Wishlist** — heart toggles everywhere, dedicated wishlist page
- **Admin** — dashboard (revenue/orders/stock), product CRUD with **signed direct-to-Cloudinary image uploads** (file bytes never touch the server), order status management, role-guarded routes
- **Polish** — Framer Motion page transitions & micro-interactions honoring `prefers-reduced-motion`, dark Nordic design system on CSS variables, skip-link + semantic landmarks, per-route metadata, responsive layouts

## Tech stack

| Layer     | Choices                                                                 |
| --------- | ----------------------------------------------------------------------- |
| Framework | Next.js 16 App Router (React 19 Server + Client Components), TypeScript  |
| Data      | Server Actions + server-component data functions (no separate REST API) |
| Auth      | Auth.js (NextAuth v5), Credentials provider over bcrypt hashes, JWT session |
| Database  | MongoDB Atlas + Mongoose 9 (multi-document transactions at checkout)     |
| Payments  | Stripe PaymentIntents (test mode)                                        |
| Images    | Cloudinary (signed direct uploads from the admin dashboard)             |
| Styling   | CSS Modules + a CSS-variable design system, `next/font`, Framer Motion   |

## Getting started

```bash
# 1. Install
cd web && npm install

# 2. Configure
cp .env.example .env.local
#    → fill in MONGODB_URI (Atlas), AUTH_SECRET (npx auth secret),
#      STRIPE_SECRET_KEY (sk_test_…), NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_…),
#      CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET

# 3. Seed the database (24 products + admin & demo accounts)
npm run seed

# 4. Run the app (:3000)
npm run dev
```

(From the repo root, `npm run dev`, `npm run build`, and `npm run seed` delegate to `web/`.)

> **Note:** the checkout transaction requires a replica-set MongoDB — Atlas works out of the box; a plain local `mongod` will not.

**Seed accounts:** `admin@nordcart.se` / `Admin1234!` · `demo@nordcart.se` / `Demo1234!`
(override with `ADMIN_SEED_PASSWORD` / `DEMO_SEED_PASSWORD` before seeding a public deployment)

**Stripe test card:** `4242 4242 4242 4242` (any future expiry, any CVC) · decline: `4000 0000 0000 0002`

## Scripts

Run from `web/` (or via the delegating scripts at the repo root):

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (:3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run seed` | Reset & seed products + users |
| `npm run seed:destroy` | Wipe seeded data |
| `npm run lint` | ESLint |

## Project structure

Single Next.js app in `web/`:

- `app/` — routes (App Router): storefront, `(protected)/` account pages, `admin/`, `api/auth/[...nextauth]`
- `actions/` — Server Actions (cart, orders, reviews, wishlist, admin, auth)
- `lib/data/` — server-only read functions; `lib/` — db connection, Stripe/Cloudinary, pricing, validation (zod), session helpers
- `models/` — Mongoose schemas (User with embedded cart/wishlist, Product, Order, Review)
- `components/` — UI, providers (cart/wishlist/toast), layout, product/review/admin components
- `auth.ts` / `auth.config.ts` / `proxy.ts` — Auth.js setup + optimistic route guards

Docs:

- Architecture & schema decisions: [`docs/specs/2026-07-02-nordcart-design.md`](docs/specs/2026-07-02-nordcart-design.md)
- **Deployment guide (single Vercel project + Atlas): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**
