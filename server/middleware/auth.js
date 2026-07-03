import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

/**
 * Require a valid JWT cookie. Loads the current user fresh from the DB
 * (not from the token payload) so role changes and deleted accounts take
 * effect immediately, and attaches it as req.user.
 */
export const protect = async (req, _res, next) => {
  const { token } = req.cookies;
  if (!token) throw new ApiError(401, 'Not logged in');

  // Invalid/expired tokens throw here; the central error handler maps
  // JsonWebTokenError / TokenExpiredError to clean 401 responses.
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);
  if (!user) throw new ApiError(401, 'Account no longer exists');

  req.user = user;
  next();
};

/**
 * Restrict a route to given roles. Must run after protect.
 * Usage: router.get('/stats', protect, authorize('admin'), handler)
 */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to do that');
    }
    next();
  };
