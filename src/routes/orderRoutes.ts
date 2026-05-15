import express from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  createOrder, verifyPayment, getUserOrders, getOrderById, cancelOrder,
  createOrderValidation, verifyPaymentValidation,
} from '../controllers/orderController';
import { validateCoupon } from '../controllers/couponController';

import rateLimit from 'express-rate-limit';

const router = express.Router();

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many orders created, please try again later' }
});

router.use(authenticate);

router.post('/', orderLimiter, createOrderValidation, createOrder);
router.post('/verify-payment', verifyPaymentValidation, verifyPayment);
// IMPORTANT: /apply-coupon MUST be before /:id — otherwise Express matches "apply-coupon" as the :id param
router.post('/apply-coupon', validateCoupon);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);
router.post('/:id/cancel', cancelOrder);

export default router;
