import ApiError from '../utils/ApiError.js';

// Any request that falls through every router becomes a consistent 404 JSON error.
const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFound;
