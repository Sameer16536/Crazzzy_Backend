import express from 'express';
import { handleRazorpayWebhook } from '../controllers/webhookController';

const router = express.Router();

// Razorpay sends webhooks as POST
router.post('/razorpay', handleRazorpayWebhook);

export default router;
