import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { confirmOrderPayment } from './orderController';

/**
 * Handle incoming Razorpay Webhooks.
 * This is crucial for reliability if the user closes the tab before verify-payment is called.
 *
 * IMPORTANT: This route must be mounted with express.raw({ type: 'application/json' })
 * BEFORE express.json() in app.ts. Razorpay signs the raw request bytes — re-stringifying
 * a parsed object changes key ordering and whitespace, breaking signature verification.
 */
export async function handleRazorpayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.warn('[Webhook] Missing signature or secret');
      return res.status(400).json({ status: 'error', message: 'Unauthorized' });
    }

    // req.body is a raw Buffer (thanks to express.raw() in app.ts).
    // We must verify against the exact original bytes.
    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(rawBody);
    const digest = shasum.digest('hex');

    if (signature !== digest) {
      console.warn('[Webhook] Invalid signature');
      return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    // Parse the verified raw payload
    const payload = JSON.parse(rawBody.toString('utf8'));
    const event: string = payload.event;
    console.log(`[Webhook] Received Razorpay event: ${event}`);

    if (event === 'order.paid') {
      // For 'order.paid', Razorpay sends both order and payment entities.
      // The canonical order ID lives on the order entity; payment ID on the payment entity.
      const orderId: string = payload.payload?.order?.entity?.id;
      const paymentId: string = payload.payload?.payment?.entity?.id;

      if (!orderId || !paymentId) {
        console.warn('[Webhook] order.paid payload missing order/payment entity IDs');
        return res.json({ status: 'ok' });
      }

      const order = await prisma.order.findFirst({ where: { paymentId: orderId } });
      if (order) {
        console.log(`[Webhook] Processing confirmation for Order #${order.id}`);
        await confirmOrderPayment(order.id, paymentId);
      } else {
        console.warn(`[Webhook] No matching order found for Razorpay Order ID: ${orderId}`);
      }
    } else if (event === 'payment.captured') {
      // For 'payment.captured', order_id is nested inside the payment entity.
      const orderId: string = payload.payload?.payment?.entity?.order_id;
      const paymentId: string = payload.payload?.payment?.entity?.id;

      if (!orderId || !paymentId) {
        console.warn('[Webhook] payment.captured payload missing order_id or payment id');
        return res.json({ status: 'ok' });
      }

      const order = await prisma.order.findFirst({ where: { paymentId: orderId } });
      if (order) {
        console.log(`[Webhook] Processing confirmation for Order #${order.id}`);
        await confirmOrderPayment(order.id, paymentId);
      } else {
        console.warn(`[Webhook] No matching order found for Razorpay Order ID: ${orderId}`);
      }
    }

    // Always respond 200 — Razorpay will retry on non-2xx responses
    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] Error:', err.message);
    // Return 200 even on processing errors to prevent infinite Razorpay retries
    res.status(200).json({ status: 'error', message: 'Internal processing error' });
  }
}
