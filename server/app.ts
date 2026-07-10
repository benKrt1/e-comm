import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.ts';
import productRoutes from './routes/productRoutes.ts';
import cartRoutes from './routes/cartRoutes.ts';
import orderRoutes from './routes/orderRoutes.ts';
import reviewRoutes from './routes/reviewRoutes.ts';
import wishlistRoutes from './routes/wishlistRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import notFound from './middleware/notFound.ts';
import errorHandler from './middleware/errorHandler.ts';

// The Express app is built here and the HTTP server lives in server.ts,
// so the app can be imported by tests without binding a port.
const app = express();

// Render/most PaaS terminate TLS at a proxy — without this, rate limiting
// would key every request on the proxy's IP instead of the client's.
app.set('trust proxy', 1);

// CORS must allow credentials for the httpOnly JWT cookie to travel.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' })); // small limit: no JSON payload here needs more
app.use(cookieParser());

// Liveness probe — also what Render pings to keep the service awake.
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'NordCart API is healthy', data: { uptime: process.uptime() } });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
