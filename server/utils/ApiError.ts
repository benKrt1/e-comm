/**
 * Operational error with an HTTP status code. Controllers throw this for
 * expected failures ("product not found", "wrong password") so the central
 * error handler can distinguish them from programmer bugs.
 */
class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
