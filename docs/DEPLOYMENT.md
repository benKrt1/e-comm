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
