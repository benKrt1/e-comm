import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { authConfig } from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        await dbConnect();

        // Password is select:false — opt in for the comparison only.
        const user = await User.findOne({ email }).select('+password');

        // null for both "no such user" and "wrong password": anything more
        // specific lets attackers enumerate registered emails.
        if (!user || !(await user.matchPassword(password))) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
