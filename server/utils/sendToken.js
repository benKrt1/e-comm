import jwt from 'jsonwebtoken';

// Cookie lifetime must mirror JWT_EXPIRES_IN (default 7d).
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared cookie options — logout must clear the cookie with the *same*
 * attributes it was set with, or browsers ignore the clear.
 */
export const cookieOptions = () => ({
  httpOnly: true, // invisible to JS → XSS cannot steal the token
  secure: process.env.NODE_ENV === 'production',
  // In production the client (Vercel) and API (Render) are different sites,
  // so the cookie must be SameSite=None. In dev the Vite proxy keeps
  // everything same-origin and Lax is the safer default.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
});

/** Fields the client is allowed to see — never the password hash. */
export const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  cart: user.cart,
  wishlist: user.wishlist,
});

/**
 * Sign a JWT for the user, set it as an httpOnly cookie, and send the
 * standard response envelope. Used by register and login.
 */
const sendToken = (res, user, statusCode, message) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res
    .status(statusCode)
    .cookie('token', token, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE_MS })
    .json({ success: true, message, data: { user: serializeUser(user) } });
};

export default sendToken;
