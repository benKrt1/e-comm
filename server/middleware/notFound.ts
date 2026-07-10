import type { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError.ts';

// Any request that falls through every router becomes a consistent 404 JSON error.
const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
