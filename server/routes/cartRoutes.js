import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart,
} from '../controllers/cartController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

// Every cart route belongs to the logged-in user — guests keep their cart
// in localStorage on the client until they log in.
router.use(protect);

const quantityRule = (field) =>
  body(field).isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99').toInt();

const productIdParam = param('productId').isMongoId().withMessage('Invalid product id');

router
  .route('/')
  .get(getCart)
  .post([body('productId').isMongoId().withMessage('Invalid product id'), quantityRule('quantity')], validate, addToCart)
  .delete(clearCart);

router.post(
  '/merge',
  [
    body('items').isArray({ max: 50 }).withMessage('items must be an array of at most 50 entries'),
    body('items.*.product').isMongoId().withMessage('Invalid product id'),
    quantityRule('items.*.quantity'),
  ],
  validate,
  mergeCart
);

router
  .route('/:productId')
  .put([productIdParam, quantityRule('quantity')], validate, updateCartItem)
  .delete([productIdParam], validate, removeFromCart);

export default router;
