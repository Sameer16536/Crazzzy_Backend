import express from 'express';
import { listProducts, getProductBySlug } from '../controllers/productController';
import { getProductReviews, addReview } from '../controllers/reviewController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', listProducts);
router.get('/:slug', getProductBySlug);

// Product Reviews
router.get('/:productId/reviews', getProductReviews);
router.post('/:productId/reviews', authenticate, addReview);

export default router;
