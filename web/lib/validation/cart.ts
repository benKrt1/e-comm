import { z } from 'zod';

// Mirrors the old express-validator cart rules: Mongo ObjectId + a sane
// per-line quantity cap.
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid product id');

export const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(99, 'Quantity cannot exceed 99');

export const mergeItemsSchema = z
  .array(z.object({ product: objectIdSchema, quantity: quantitySchema }))
  .max(100, 'Too many items');
