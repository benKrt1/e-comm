import type { NextAuthConfig } from 'next-auth';

/**
 * Auth config shared between the full server setup (auth.ts) and the proxy.
 * Must stay free of Node-only imports (mongoose, bcrypt) so the proxy bundle
 * stays lean — the Credentials provider lives in auth.ts only.
 */
export const authConfig = {
  pages: { signIn: '/login' },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // matches the old JWT_EXPIRES_IN=7d
  },
  callbacks: {
    // Copy id + role into the token at sign-in so the proxy and session
    // callback can read them without a DB round-trip.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
  providers: [], // filled in by auth.ts
} satisfies NextAuthConfig;
