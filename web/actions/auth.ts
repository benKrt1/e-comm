'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/validation/auth';

export type ActionResult = { success: boolean; message: string };

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

  const { email, password } = parsed.data;

  await dbConnect();

  // Validate here (before signIn) so we can greet by name on success and
  // return one generic message for both "no such user" and "wrong password".
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return { success: false, message: 'Invalid email or password' };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return { success: false, message: 'Invalid email or password' };
    throw err;
  }

  return { success: true, message: `Welcome back, ${user.name.split(' ')[0]}` };
}

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };

  const { name, email, password } = parsed.data;

  await dbConnect();

  // Explicit check for a friendlier message than the raw duplicate-key error.
  const existing = await User.findOne({ email });
  if (existing) return { success: false, message: 'An account with that email already exists' };

  await User.create({ name, email, password });

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      // Account exists but auto-login failed — let the user log in manually.
      return { success: false, message: 'Account created — please log in' };
    }
    throw err;
  }

  return { success: true, message: 'Account created — welcome to NordCart' };
}

export async function logoutAction(): Promise<ActionResult> {
  await signOut({ redirect: false });
  return { success: true, message: 'Logged out — see you soon' };
}
