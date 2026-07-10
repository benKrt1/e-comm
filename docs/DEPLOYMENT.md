# Deploying NordCart — Vercel + Render + MongoDB Atlas

The frontend (`web/`, Next.js) goes to **Vercel**, the API (`server/`, Express) to **Render**, the database to **MongoDB Atlas**. All three have free tiers that fit this project. Because the two apps live on different origins in production, the JWT cookie must be cross-site (`SameSite=None; Secure`) and CORS must name the exact frontend origin — both are handled in code once `NODE_ENV=production`.

## 1. MongoDB Atlas

1. Create a free (M0) cluster and a database user (Database Access → Add user, password auth).
2. **Network Access → Add IP → `0.0.0.0/0`** ("allow from anywhere"). Render's free-tier egress IPs rotate, so a single-IP allowlist breaks the API. Credentials still gate access.
3. Copy the connection string (Database → Connect → Drivers) — it becomes `MONGO_URI`.
4. Checkout uses multi-document transactions, which need a replica set: **Atlas clusters always are one** — nothing to configure. (A local standalone `mongod` cannot run checkout.)

## 2. API on Render

Create a **Web Service** from this repo:

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` (runs `tsx server.ts`) |
| Health check path | `/api/v1/health` |

Environment variables:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` (switches the cookie to `Secure` + `SameSite=None` for the cross-site frontend) |
| `MONGO_URI` | the Atlas connection string |
| `JWT_SECRET` | long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | your Vercel URL (e.g. `https://nordcart.vercel.app`) — CORS allows exactly this origin, with credentials |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from the Cloudinary dashboard |

`trust proxy` is already set (rate limiting keys on real client IPs behind Render's proxy); the health endpoint doubles as a keep-awake ping target for free-tier spin-down.

## 3. Seed the production database

Run locally against the production connection string (mind the shell history — or export the vars):

```bash
cd server
MONGO_URI='<atlas-uri>' ADMIN_SEED_PASSWORD='<strong>' DEMO_SEED_PASSWORD='<strong>' npm run seed
```

Never ship the default seed passwords to a public deployment.

## 4. Frontend on Vercel

Import the repo as a new project:

| Setting | Value |
| --- | --- |
| Root directory | `web` |
| Framework preset | Next.js (auto-detected) |

Environment variables:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<your-render-service>.onrender.com/api/v1` (the absolute API root — the axios layer uses it in production instead of the dev `/api` rewrite) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |

## 5. Post-deploy checklist

- [ ] `https://<render>/api/v1/health` returns `{ "success": true, … }`
- [ ] Register/login on the Vercel site works and **survives a hard refresh** (if not: `CLIENT_URL` mismatch or `NODE_ENV` ≠ production — the cookie needs `SameSite=None; Secure` cross-site, and CORS must name the exact origin)
- [ ] Guest cart merges into the account on login
- [ ] Checkout with `4242 4242 4242 4242` completes and the order appears under `/orders`; a double-submit returns the same order (idempotent on the payment id)
- [ ] A verified purchaser can leave one review; the product rating updates
- [ ] Admin login (`admin@nordcart.se`) → product image upload works (Cloudinary vars); a non-admin visiting `/admin` is redirected home
- [ ] First request after idle takes ~30–60 s: Render free tier spins down; the health-check ping or an external uptime pinger mitigates it
