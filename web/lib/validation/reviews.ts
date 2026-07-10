import { z } from 'zod';
import { objectIdSchema } from './cart';

// Mirrors the old express-validator review rules (server/routes/reviewRoutes.js).
export const reviewInputSchema = z.object({
  rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  title: z.string().trim().min(2, 'Title must be between 2 and 100 characters').max(100, 'Title must be between 2 and 100 characters'),
  comment: z
    .string()
    .trim()
    .min(2, 'Comment must be between 2 and 1000 characters')
    .max(1000, 'Comment must be between 2 and 1000 characters'),
});

export { objectIdSchema };

export type ReviewInput = z.input<typeof reviewInputSchema>;
