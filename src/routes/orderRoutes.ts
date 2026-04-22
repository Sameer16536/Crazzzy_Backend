import express from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  createOrder, verifyPayment, getUserOrders, getOrderById,
  createOrderValidation, verifyPaymentValidation,
} from '../controllers/orderController';
import { validateCoupon } from '../controllers/couponController';

const router = express.Router();

router.use(authenticate);

router.post('/', createOrderValidation, createOrder);
router.post('/verify-payment', verifyPaymentValidation, verifyPayment);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);

// Order specifics
router.post('/apply-coupon', validateCoupon);

export default router;
