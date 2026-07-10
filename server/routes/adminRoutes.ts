import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getStats,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllOrders,
  updateOrderStatus,
  getUploadSignature,
} from '../controllers/adminController.ts';
import { protect, authorize } from '../middleware/auth.ts';
import validate from '../middleware/validate.ts';
import { PRODUCT_CATEGORIES } from '../models/Product.ts';

const router = Router();

// Everything here is staff-only.
router.use(protect, authorize('admin'));

const idParam = param('id').isMongoId().withMessage('Invalid id');

const productRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Name must be between 2 and 120 characters'),
  body('description').trim().isLength({ min: 2, max: 2000 }).withMessage('Description must be between 2 and 2000 characters'),
  body('brand').trim().isLength({ min: 1, max: 60 }).withMessage('Brand is required'),
  body('category').isIn([...PRODUCT_CATEGORIES]).withMessage('Unknown category'),
  body('price').isInt({ min: 0 }).withMessage('Price must be a non-negative integer amount of öre').toInt(),
  body('countInStock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer').toInt(),
  body('images').isArray({ min: 1, max: 8 }).withMessage('At least one image is required'),
  body('images.*.url').isURL({ protocols: ['https'] }).withMessage('Image url must be https'),
  body('images.*.alt').trim().isLength({ min: 2, max: 200 }).withMessage('Every image needs alt text'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean').toBoolean(),
];

router.get('/stats', getStats);

router.post('/products', productRules, validate, createProduct);
router
  .route('/products/:id')
  .get([idParam], validate, getProductById)
  .put([idParam, ...productRules], validate, updateProduct)
  .delete([idParam], validate, deleteProduct);

router.get('/orders', getAllOrders);
router.put(
  '/orders/:id/status',
  [idParam, body('status').isIn(['pending', 'shipped', 'delivered']).withMessage('Unknown status')],
  validate,
  updateOrderStatus
);

router.post('/uploads/signature', getUploadSignature);

export default router;
