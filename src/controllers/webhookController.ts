import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { confirmOrderPayment } from './orderController';

/**
 * Handle incoming Razorpay Webhooks.
 * This is crucial for reliability if the user closes the tab before verify-payment is called.
 */
export async function handleRazorpayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.warn('[Webhook] Missing signature or secret');
      return res.status(400).json({ status: 'error', message: 'Unauthorized' });
    }

    // Verify signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (signature !== digest) {
      console.warn('[Webhook] Invalid signature');
      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    const event = req.body.event;
    console.log(`[Webhook] Received Razorpay event: ${event}`);

    // Handle specific events
    // order.paid is usually the best one for our flow
    if (event === 'order.paid' || event === 'payment.captured') {
      const { order_id, id: payment_id } = req.body.payload.payment.entity;
      
      // Find order by Razorpay Order ID
      const order = await prisma.order.findFirst({
        where: { paymentId: order_id }
      });

      if (order) {
        console.log(`[Webhook] Processing confirmation for Order #${order.id}`);
        await confirmOrderPayment(order.id, payment_id);
      } else {
        console.warn(`[Webhook] No matching order found for Razorpay Order ID: ${order_id}`);
      }
    }

    // Always respond with 200 to Razorpay
    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] Error:', err.message);
    // Still return 200 to Razorpay to prevent retries of invalid payloads
    res.status(200).json({ status: 'error', message: 'Internal processing error' });
  }
}
