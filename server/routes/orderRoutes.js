import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  createPaymentIntent,
  createOrder,
  getMyOrders,
  getOrderById,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

// Orders are always personal — every route requires a session.
router.use(protect);

router.post('/payment-intent', createPaymentIntent);

router.post(
  '/',
  [
    body('paymentIntentId')
      .isString()
      .matches(/^pi_\w{1,200}$/)
      .withMessage('Invalid payment reference'),
    body('shippingAddress.fullName').trim().isLength({ min: 2, max: 100 }).withMessage('Full name is required'),
    body('shippingAddress.street').trim().isLength({ min: 2, max: 120 }).withMessage('Street is required'),
    body('shippingAddress.postalCode').trim().isLength({ min: 2, max: 20 }).withMessage('Postal code is required'),
    body('shippingAddress.city').trim().isLength({ min: 1, max: 80 }).withMessage('City is required'),
    body('shippingAddress.country').trim().isLength({ min: 2, max: 60 }).withMessage('Country is required'),
  ],
  validate,
  createOrder
);

// NOTE: /mine must stay above /:id or "mine" gets parsed as an ObjectId.
router.get('/mine', getMyOrders);
router.get('/:id', [param('id').isMongoId().withMessage('Invalid order id')], validate, getOrderById);

export default router;
