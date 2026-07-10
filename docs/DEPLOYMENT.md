# Deploying NordCart — Vercel + MongoDB Atlas

NordCart is a single full-stack **Next.js** app (App Router). It deploys as **one Vercel project**; the database lives on **MongoDB Atlas**. Both have free tiers that fit this project. There is no separate API service — the old Express backend is now Server Actions and server-component data functions running inside the same deployment, so there is no CORS and no cross-site cookie to configure.

## 1. MongoDB Atlas

1. Create a free (M0) cluster and a database user (Database Access → Add user, password auth).
2. **Network Access → Add IP → `0.0.0.0/0`** ("allow from anywhere"). Vercel's serverless egress IPs are not stable, so a single-IP allowlist breaks the deployment. Credentials still gate access.
3. Copy the connection string (Database → Connect → Drivers) — it becomes `MONGODB_URI`.
4. The checkout flow uses multi-document transactions, which need a replica set: **Atlas clusters always are one** — nothing to configure. (A local standalone `mongod` cannot run checkout.)

## 2. The Vercel project

Import the repo as a new project:

| Setting | Value |
| --- | --- |
| Root directory | `web` |
| Framework preset | Next.js (auto-detected) |

Vercel runs `next build` and serves the app; no `vercel.json` is needed.

Environment variables (Project → Settings → Environment Variables):

| Key | Value |
| --- | --- |
| `MONGODB_URI` | the Atlas connection string |
| `AUTH_SECRET` | session encryption secret — generate with `npx auth secret` (or `openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (public by design) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from the Cloudinary dashboard |

`AUTH_TRUST_HOST` is **not** needed on Vercel (the platform is trusted automatically). Auth.js sets a secure session cookie on the app's own origin — same-site, so nothing extra to configure.

## 3. Seed the production database

Run locally against the production connection string (mind the shell history — or export the vars):

```bash
cd web
MONGODB_URI='<atlas-uri>' ADMIN_SEED_PASSWORD='<strong>' DEMO_SEED_PASSWORD='<strong>' npm run seed
```

Never ship the default seed passwords to a public deployment.

## 4. Post-deploy checklist

- [ ] The homepage and `/products` render server-side (view source shows product HTML)
- [ ] Register / login works and **survives a hard refresh** (Auth.js JWT session cookie)
- [ ] Guest cart merges into the account on login
- [ ] Checkout with `4242 4242 4242 4242` completes and the order appears under `/orders`; a double-submit returns the same order (idempotent on the payment id)
- [ ] A verified purchaser can leave one review; the product rating updates
- [ ] Admin login (`admin@nordcart.se`) → product image upload works (Cloudinary vars); a non-admin visiting `/admin` is redirected home

## Notes on the architecture

- **No webhook.** Orders are created client-driven after a confirmed PaymentIntent and are idempotent on the payment id (unique index). This avoids webhook setup; the trade-off is documented in `web/actions/orders.ts`.
- **Cloudinary uploads are signed and direct.** The server only issues a short-lived signature (`getUploadSignatureAction`); image bytes go browser → Cloudinary and never touch the serverless function.
- **Rate limiting** is intentionally omitted at first (bcrypt cost throttles brute force; in-memory counters are useless across serverless instances). Add `@upstash/ratelimit` on the login/register actions if the site sees real traffic.
