import express from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  createOrder, verifyPayment, getUserOrders, getOrderById, cancelOrder,
  createOrderValidation, verifyPaymentValidation,
} from '../controllers/orderController';
import { validateCoupon } from '../controllers/couponController';

const router = express.Router();

router.use(authenticate);

router.post('/', createOrderValidation, createOrder);
router.post('/verify-payment', verifyPaymentValidation, verifyPayment);
// IMPORTANT: /apply-coupon MUST be before /:id — otherwise Express matches "apply-coupon" as the :id param
router.post('/apply-coupon', validateCoupon);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);
router.post('/:id/cancel', cancelOrder);

export default router;
