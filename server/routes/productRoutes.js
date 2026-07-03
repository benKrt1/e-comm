import { Router } from 'express';
import { query, param } from 'express-validator';
import {
  getProducts,
  getFeaturedProducts,
  getProductMeta,
  getProductBySlug,
} from '../controllers/productController.js';
import { PRODUCT_CATEGORIES } from '../models/Product.js';
import { SORT_OPTIONS, MAX_PAGE_SIZE } from '../utils/queryFeatures.js';
import validate from '../middleware/validate.js';

const router = Router();

router.get(
  '/',
  [
    query('category').optional().isIn(PRODUCT_CATEGORIES).withMessage('Unknown category'),
    query('sort').optional().isIn(Object.keys(SORT_OPTIONS)).withMessage('Unknown sort option'),
    query('minPrice').optional().isInt({ min: 0 }).withMessage('minPrice must be a positive integer (öre)'),
    query('maxPrice').optional().isInt({ min: 0 }).withMessage('maxPrice must be a positive integer (öre)'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: MAX_PAGE_SIZE }).withMessage(`limit must be 1–${MAX_PAGE_SIZE}`),
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  ],
  validate,
  getProducts
);

// Static paths must be declared before the /:slug catch-all.
router.get('/featured', getFeaturedProducts);
router.get('/meta', getProductMeta);

router.get(
  '/:slug',
  [param('slug').isSlug().withMessage('Invalid product slug')],
  validate,
  getProductBySlug
);

export default router;
