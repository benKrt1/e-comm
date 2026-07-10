import { z } from 'zod';

// Mirrors the old express-validator order rules (server/routes/orderRoutes.js).
export const paymentIntentIdSchema = z
  .string()
  .regex(/^pi_\w{1,200}$/, 'Invalid payment reference');

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  street: z.string().trim().min(2, 'Street is required').max(120),
  postalCode: z.string().trim().min(2, 'Postal code is required').max(20),
  city: z.string().trim().min(1, 'City is required').max(80),
  country: z.string().trim().min(2, 'Country is required').max(60),
});

export type ShippingAddressInput = z.input<typeof shippingAddressSchema>;
