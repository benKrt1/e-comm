import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

/**
 * Optimistic route protection (Next 16 "proxy", formerly middleware).
 * Everything the matcher catches requires a session; /admin additionally
 * requires the admin role. Layouts and server actions re-verify against the
 * DB — this is just the fast redirect for browsers.
 */
export default auth((req) => {
  const { nextUrl } = req;

  if (!req.auth?.user) {
    const loginUrl = new URL('/login', nextUrl);
    // Send the user back where they were headed after logging in.
    loginUrl.searchParams.set('redirect', nextUrl.pathname + nextUrl.search);
    return Response.redirect(loginUrl);
  }

  if (nextUrl.pathname.startsWith('/admin') && req.auth.user.role !== 'admin') {
    return Response.redirect(new URL('/', nextUrl));
  }
});

export const config = {
  matcher: ['/checkout', '/orders/:path*', '/profile', '/wishlist', '/admin/:path*'],
};
