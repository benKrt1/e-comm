import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for credential endpoints (login/register) to slow down
 * brute-force and enumeration attempts. Keyed by IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many attempts — please try again in 15 minutes',
      data: null,
    });
  },
});
