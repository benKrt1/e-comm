import { z } from 'zod';
import { PRODUCT_CATEGORIES } from '@/lib/categories';

// Mirrors the old express-validator product rules (server/routes/adminRoutes.js).
export const productSchema = z.object({
  name: z.string().trim().min(2, 'Name must be between 2 and 120 characters').max(120, 'Name must be between 2 and 120 characters'),
  description: z
    .string()
    .trim()
    .min(2, 'Description must be between 2 and 2000 characters')
    .max(2000, 'Description must be between 2 and 2000 characters'),
  brand: z.string().trim().min(1, 'Brand is required').max(60, 'Brand is required'),
  category: z.enum(PRODUCT_CATEGORIES, { message: 'Unknown category' }),
  price: z.number().int('Price must be an integer amount of öre').min(0, 'Price must be non-negative'),
  countInStock: z.number().int('Stock must be a whole number').min(0, 'Stock must be non-negative'),
  images: z
    .array(
      z.object({
        url: z.url('Image url must be a valid URL').refine((u) => u.startsWith('https://'), 'Image url must be https'),
        alt: z.string().trim().min(2, 'Every image needs alt text').max(200, 'Alt text is too long'),
      })
    )
    .min(1, 'At least one image is required')
    .max(8, 'At most 8 images'),
  isFeatured: z.boolean().optional(),
});

export const orderStatusSchema = z.enum(['pending', 'shipped', 'delivered'], { message: 'Unknown status' });

export type ProductInput = z.input<typeof productSchema>;
