import type { Request, Response, NextFunction } from 'express';

interface MongooseValidationError {
  errors: Record<string, { message: string }>;
}

/**
 * Central error handler — every error in the API funnels here (Express 5
 * forwards rejected promises from async handlers automatically).
 * Translates known error shapes into clean client-facing messages and
 * always responds with the { success, message, data } envelope.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  let statusCode: number = err.statusCode || 500;
  let message: string = err.message || 'Internal server error';

  // Mongoose: malformed ObjectId in a URL param
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values((err as MongooseValidationError).errors)
      .map((e) => e.message)
      .join('. ');
  }

  // Mongoose: optimistic-concurrency clash — two requests saved the same
  // document at once (e.g. a double-clicked add-to-cart, or cart/wishlist
  // writes racing from two tabs). Benign; retryable.
  if (err.name === 'VersionError') {
    statusCode = 409;
    message = 'Your data changed in another request — please try again';
  }

  // MongoDB: unique index violation (e.g. duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    message = `That ${field} is already in use`;
  }

  // JWT: tampered or expired token
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired, please log in again';
  }

  // Never leak internals of unexpected (programmer) errors in production.
  if (statusCode === 500) {
    console.error('✖ Unexpected error:', err);
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }

  res.status(statusCode).json({ success: false, message, data: null });
};

export default errorHandler;
