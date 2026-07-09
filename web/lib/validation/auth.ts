import { z } from 'zod';

// Mirrors the old express-validator rules (server/routes/authRoutes.js) and
// the User schema constraints.
export const loginSchema = z.object({
  email: z.email('Enter a valid email address').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be 2–50 characters')
    .max(50, 'Name must be 2–50 characters'),
  email: z.email('Enter a valid email address').transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
