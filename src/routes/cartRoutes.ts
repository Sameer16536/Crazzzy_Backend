import express from 'express';
import { getCart, mergeCart, updateCartItem, clearCart, syncCart } from '../controllers/cartController';
import { authenticate } from '../middlewares/authMiddleware';

const router = express.Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/merge', mergeCart);
router.post('/sync', syncCart);
router.put('/item', updateCartItem);
router.delete('/', clearCart);

export default router;
