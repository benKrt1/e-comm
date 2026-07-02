# NordCart — Approved Design (2026-07-02)

Portfolio e-commerce app. Stack (strict): React 18 (Vite) + React Router v6 + Context/useReducer + Axios + Framer Motion + CSS Modules on the client; Node/Express + JWT (httpOnly cookies) + bcrypt + express-validator on the server; MongoDB Atlas via Mongoose; Stripe test mode; Cloudinary for admin image uploads.

## Decisions

- **Styling:** CSS Modules per component + `global.css` with CSS variables. Theme: deep charcoal `#111318`, accent aurora green `#5EEAD4`, Space Grotesk headings, Inter body.
- **Image storage:** Cloudinary (Render's disk is ephemeral). Seed products use Unsplash URLs.
- **Product domain:** Tech & audio — categories: audio, keyboards, smart-home, desk, wearables, accessories.
- **Money:** integer cents (öre) everywhere; formatted client-side with `Intl.NumberFormat('sv-SE')`. Stripe expects integers anyway.
- **Cart & wishlist:** embedded on the User document (1:1 with user, always fetched together, never queried independently). Guest cart lives in localStorage and merges into `user.cart` on login.
- **Orders:** items are snapshots (name/price/image copied at purchase), so history stays accurate when products change.
- **Reviews:** separate collection; compound unique index `{ user, product }`; a static recalculates the denormalized `Product.rating`/`numReviews` after every write. Controller enforces verified-purchaser (paid order containing the product).
- **API:** REST under `/api/v1/`, JSON envelope `{ success, message, data }`, centralized error handler, rate limiting on auth routes.

## Schemas

**User:** name, email (unique, lowercase), password (bcrypt, `select: false`), role enum user/admin, cart `[{ product, quantity }]`, wishlist `[ObjectId]`, timestamps. Method `matchPassword`.

**Product:** name (unique), slug (pre-save from name), description, brand, category enum, price (int cents), images `[{ url, alt }]`, countInStock, rating + numReviews (denormalized), isFeatured, timestamps. Text index on name/description/brand; compound index `{ category, price }`.

**Order:** user (indexed), orderItems snapshot array, shippingAddress, paymentResult (Stripe PaymentIntent id), itemsPrice/shippingPrice/taxPrice/totalPrice (int cents), isPaid, status enum pending/shipped/delivered, timestamps.

**Review:** user, product, rating 1–5, title, comment, timestamps. Unique `{ user, product }`.

## Build phases

1. Scaffolding, server setup, DB connection, User + Product models, seed script (24 products + admin + demo user)
2. Auth end-to-end
3. Catalog + product detail
4. Cart
5. Checkout + Stripe + orders
6. Reviews + wishlist
7. Admin dashboard
8. Polish: animations, responsiveness, a11y, README, deployment guide (Vercel + Render + Atlas)
