import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { getReviews, createReview, updateReview, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

const ratingRule = body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt();
const titleRule = body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Title must be between 2 and 100 characters');
const commentRule = body('comment').trim().isLength({ min: 2, max: 1000 }).withMessage('Comment must be between 2 and 1000 characters');
const idParam = param('id').isMongoId().withMessage('Invalid review id');

// Reading reviews is public — everyone sees social proof.
router.get('/', [query('product').isMongoId().withMessage('Invalid product id')], validate, getReviews);

router.post(
  '/',
  protect,
  [body('productId').isMongoId().withMessage('Invalid product id'), ratingRule, titleRule, commentRule],
  validate,
  createReview
);

router.put('/:id', protect, [idParam, ratingRule, titleRule, commentRule], validate, updateReview);
router.delete('/:id', protect, [idParam], validate, deleteReview);

export default router;
