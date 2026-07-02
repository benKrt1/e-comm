/**
 * Central error handler — every error in the API funnels here (Express 5
 * forwards rejected promises from async handlers automatically).
 * Translates known error shapes into clean client-facing messages and
 * always responds with the { success, message, data } envelope.
 */
const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Mongoose: malformed ObjectId in a URL param
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
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
