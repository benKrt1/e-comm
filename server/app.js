import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

// The Express app is built here and the HTTP server lives in server.js,
// so the app can be imported by tests or serverless wrappers without binding a port.
const app = express();

// Render/most PaaS terminate TLS at a proxy — without this, rate limiting
// would key every request on the proxy's IP instead of the client's.
app.set('trust proxy', 1);

// CORS must allow credentials for the httpOnly JWT cookie to travel.
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' })); // small limit: no JSON payload here needs more
app.use(cookieParser());

// Liveness probe — also what Render pings to keep the service awake.
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, message: 'NordCart API is healthy', data: { uptime: process.uptime() } });
});

app.use('/api/v1/auth', authRoutes);

// Feature routers are mounted here as each phase lands:
// app.use('/api/v1/products', productRoutes); — Phase 3
// app.use('/api/v1/cart', cartRoutes);        — Phase 4
// app.use('/api/v1/orders', orderRoutes);     — Phase 5
// app.use('/api/v1/reviews', reviewRoutes);   — Phase 6
// app.use('/api/v1/admin', adminRoutes);      — Phase 7

app.use(notFound);
app.use(errorHandler);

export default app;
