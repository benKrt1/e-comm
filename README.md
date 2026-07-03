# NordCart 🛒

A modern, fully animated e-commerce web application for Nordic-designed tech & audio gear.
Built as a full-stack portfolio project: **React 18 · Express 5 · MongoDB · Stripe**.

> 🚧 **Work in progress** — Phase 1 of 8 complete (scaffolding, database models, seed data).
> The full README with screenshots, feature tour, and deployment guide lands in Phase 8.

## Tech stack

| Layer     | Choices                                                                 |
| --------- | ----------------------------------------------------------------------- |
| Frontend  | React 18 (Vite), React Router v6, Context API + useReducer, Axios, Framer Motion, CSS Modules |
| Backend   | Node.js, Express 5, JWT auth (httpOnly cookies), bcrypt, express-validator |
| Database  | MongoDB Atlas + Mongoose 9                                               |
| Payments  | Stripe (test mode)                                                      |
| Images    | Cloudinary (admin uploads)                                              |

## Getting started

```bash
# 1. Install everything (root, server, client)
npm install && npm install --prefix server && npm install --prefix client

# 2. Configure the server — you need a free MongoDB Atlas cluster
cp server/.env.example server/.env   # then fill in MONGO_URI and JWT_SECRET

# 3. Seed the database (24 products + admin & demo accounts)
npm run seed

# 4. Run API (:5001) and storefront (:5173) together
npm run dev
```

Demo accounts created by the seeder: `admin@nordcart.se` / `Admin1234!` and `demo@nordcart.se` / `Demo1234!`
(override with `ADMIN_SEED_PASSWORD` / `DEMO_SEED_PASSWORD` before seeding a public deployment).

## Project structure

Monorepo: `server/` (REST API under `/api/v1/`, routes → controllers → models) and `client/` (Vite app).
The approved architecture and schema design lives in [`docs/specs/`](docs/specs/2026-07-02-nordcart-design.md).
