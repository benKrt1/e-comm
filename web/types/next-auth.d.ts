import type { DefaultSession } from 'next-auth';

export type UserRole = 'user' | 'admin';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }
}

// next-auth/jwt only re-exports @auth/core/jwt, so the JWT interface must be
// augmented at its declaration site for the merge to apply.
declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
