import type { Request, Response } from 'express';
import User from '../models/User.ts';
import ApiError from '../utils/ApiError.ts';
import sendToken, { cookieOptions, serializeUser } from '../utils/sendToken.ts';

// POST /api/v1/auth/register
export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  // Explicit check for a friendlier message than the raw duplicate-key 409.
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'An account with that email already exists');

  const user = await User.create({ name, email, password });
  sendToken(res, user, 201, 'Account created — welcome to NordCart');
};

// POST /api/v1/auth/login
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Password is select:false — opt in for the comparison only.
  const user = await User.findOne({ email }).select('+password');

  // One generic message for both "no such user" and "wrong password":
  // anything more specific lets attackers enumerate registered emails.
  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  sendToken(res, user, 200, `Welcome back, ${user.name.split(' ')[0]}`);
};

// POST /api/v1/auth/logout
export const logout = (_req: Request, res: Response) => {
  // Clearing requires the same attributes the cookie was set with.
  res.clearCookie('token', cookieOptions()).json({ success: true, message: 'Logged out', data: null });
};

// GET /api/v1/auth/me — session restore for the client on page load
export const getMe = (req: Request, res: Response) => {
  res.json({ success: true, message: 'Current user', data: { user: serializeUser(req.user!) } });
};
