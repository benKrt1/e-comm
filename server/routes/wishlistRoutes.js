import { Router } from 'express';
import { param } from 'express-validator';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlistController.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';

const router = Router();

// The wishlist only exists on the account — no guest flavor (spec decision).
router.use(protect);

const productIdParam = param('productId').isMongoId().withMessage('Invalid product id');

router.get('/', getWishlist);
router.post('/:productId', [productIdParam], validate, addToWishlist);
router.delete('/:productId', [productIdParam], validate, removeFromWishlist);

export default router;
