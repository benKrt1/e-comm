// Client-safe constant (no mongoose): shared by the Product model, the
// product zod schema, and the admin form. Importing the model into a client
// component would drag mongoose into the browser bundle.
export const PRODUCT_CATEGORIES = [
  'audio',
  'keyboards',
  'smart-home',
  'desk',
  'wearables',
  'accessories',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
