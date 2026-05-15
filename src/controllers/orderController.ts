import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';
import { sendOrderReceiptEmail } from '../config/mail';
import { OrderStatus, DiscountType } from '@prisma/client';
import Razorpay from 'razorpay';
import { calculateOrderPricing, PricingItem } from '../utils/pricing';

let razorpay: Razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Each item must have a valid productId'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item must have a valid quantity (min 1)'),
  body('addressId').notEmpty().withMessage('Address ID is required'),
  body('phoneNumber').trim().notEmpty(),
  body('couponCode').optional().trim(),
];

export const verifyPaymentValidation = [
  body('razorpay_order_id').trim().notEmpty(),
  body('razorpay_payment_id').trim().notEmpty(),
  body('razorpay_signature').trim().notEmpty(),
  body('orderId').isInt({ min: 1 }),
];

function validate(req: Request) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw createError(422, errors.array()[0].msg);
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    if (!razorpay) throw createError(500, 'Razorpay is not configured');

    const { items, addressId, phoneNumber, couponCode } = req.body;
    const userId = req.user!.id;

    const address = await prisma.address.findUnique({ where: { id: parseInt(addressId) } });
    if (!address || address.userId !== userId) throw createError(404, 'Address not found');
    const shippingAddressStr = `${address.street}, ${address.city}, ${address.state} - ${address.postalCode}`;

    let subtotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ 
        where: { id: item.productId },
        include: { variants: true, category: true }
      });

      if (!product) throw createError(404, `Product ID ${item.productId} not found`);
      if (!product.isActive) throw createError(400, `Product "${product.title}" is unavailable`);
      
      let price = Number(product.price);
      let stockToCheck = product.stock;

      // If a specific variant is selected
      if (item.variantId) {
        const variant = product.variants.find(v => v.id === item.variantId);
        if (!variant) throw createError(400, `Invalid variant for product "${product.title}"`);
        
        // Use variant-specific price if it exists, otherwise use base price
        if (variant.additionalPrice && Number(variant.additionalPrice) > 0) {
          price += Number(variant.additionalPrice);
        }
        stockToCheck = variant.stock;
      }

      if (stockToCheck < item.quantity) {
        throw createError(400, `Insufficient stock for "${product.title}" ${item.variantId ? '(selected variant)' : ''}`);
      }
      
      subtotal += price * item.quantity;
      validatedItems.push({ 
        productId: product.id, 
        variantId: item.variantId || null,
        quantity: item.quantity, 
        price: price,
        categorySlug: product.category.slug
      });
    }

    // --- Automatic Discounts & Shipping Logic ---
    const [categoryOffers, comboDeals] = await Promise.all([
      prisma.categoryOffer.findMany({ where: { isActive: true } }),
      prisma.comboDeal.findMany({ where: { isActive: true } })
    ]);

    const pricing = calculateOrderPricing(validatedItems, categoryOffers, comboDeals);
    
    let discountApplied = pricing.comboDiscount;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon || !coupon.isActive) throw createError(400, 'Invalid coupon code');
      if (coupon.expiresAt && new Date() > coupon.expiresAt) throw createError(400, 'Coupon has expired');
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw createError(400, 'Coupon usage limit reached');

      let couponDiscount = 0;
      if (coupon.discountType === DiscountType.PERCENTAGE) {
        couponDiscount = ((subtotal - pricing.comboDiscount) * Number(coupon.discountValue)) / 100;
      } else {
        couponDiscount = Number(coupon.discountValue);
      }
      discountApplied += couponDiscount;
      if (discountApplied > subtotal) discountApplied = subtotal;
    }

    const shippingAmount = pricing.shippingAmount;
    const totalAmount = subtotal - discountApplied + shippingAmount;
    const amountInPaise = Math.round(totalAmount * 100);

    if (amountInPaise < 100) {
      throw createError(400, 'Minimum order amount is ₹1.00');
    }

    const rpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${userId}_${Date.now()}`,
    });

    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: OrderStatus.PENDING,
          paymentId: rpOrder.id,
          shippingAddress: shippingAddressStr,
          phoneNumber,
          couponCode: couponCode || null,
          discountApplied,
          shippingAmount,
          items: {
            create: validatedItems.map(item => ({
              productId: item.productId,
              productVariantId: item.variantId,
              quantity: item.quantity,
              price: item.price
            }))
          }
        }
      });

      if (couponCode) {
        await tx.coupon.update({
          where: { code: couponCode },
          data: { usedCount: { increment: 1 } }
        });
      }

      return order;
    });

    res.status(201).json({
      success: true,
      message: 'Order created. Proceed to payment.',
      orderId: newOrder.id,
      razorpay: {
        key_id: process.env.RAZORPAY_KEY_ID,
        razorpay_order_id: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
      }
    });

  } catch (err) { next(err); }
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { user: true, items: { include: { product: true } } }
    });

    if (!order || order.userId !== req.user!.id || order.status !== OrderStatus.PENDING) {
      throw createError(404, 'Order not found or already processed');
    }

    if (order.paymentId !== razorpay_order_id) {
      throw createError(400, 'Razorpay order ID mismatch');
    }

    const body_str = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body_str)
      .digest('hex');

    // Prevent timingSafeEqual crash on length mismatch
    const expectedBuffer = Buffer.from(expectedSignature);
    const signatureBuffer = Buffer.from(razorpay_signature);
    
    if (expectedBuffer.length !== signatureBuffer.length) {
      throw createError(400, 'Payment verification failed: Invalid signature');
    }

    const signaturesMatch = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

    if (!signaturesMatch) throw createError(400, 'Payment verification failed: Invalid signature');

    await confirmOrderPayment(order.id, razorpay_payment_id);
    res.json({ success: true, message: 'Payment verified. Order confirmed!', orderId: order.id });
  } catch (err) { next(err); }
}

export async function getUserOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { items: { include: { product: { select: { title: true, imageUrl: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: parseInt(req.params.id as string, 10), userId: req.user!.id },
      include: { items: { include: { product: { select: { title: true, imageUrl: true } } } } }
    });
    if (!order) throw createError(404, 'Order not found');
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id as string, 10);
    const userId = req.user!.id;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true }
    });

    if (!order) throw createError(404, 'Order not found');

    // CANCEL ONLY IF NOT SHIPPED/DELIVERED
    if (([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED] as OrderStatus[]).includes(order.status)) {
      throw createError(400, `Cannot cancel order in "${order.status}" status`);
    }

    // HANDLE RAZORPAY REFUND IF PAID
    if (order.status === OrderStatus.PAID && order.paymentId) {
      if (!razorpay) throw createError(500, 'Razorpay not configured for refund');
      
      try {
        console.log(`[Refund] Initiating for Payment ID: ${order.paymentId}, Amount: ${order.totalAmount}`);
        await razorpay.payments.refund(order.paymentId, {
          amount: Math.round(Number(order.totalAmount) * 100),
          notes: { reason: 'User cancelled order' }
        });
      } catch (refundErr: any) {
        console.error('Razorpay Refund Error:', JSON.stringify(refundErr, null, 2));
        
        // If in development/test, allow cancellation to proceed even if refund fails (for fake IDs)
        if (process.env.NODE_ENV !== 'production') {
           console.warn("Dev/Test Mode: Refund failed (likely due to fake Payment ID), proceeding with cancellation anyway.");
        } else {
           throw createError(500, refundErr.description || 'Refund failed via Razorpay. Please contact support.');
        }
      }
    }

    // RESTORE STOCK & UPDATE STATUS
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED }
      });

      for (const item of order.items) {
        if (item.productVariantId) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } }
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
      }
    });

    res.json({ success: true, message: 'Order cancelled successfully and stock restored.' });
  } catch (err) { next(err); }
}

/**
 * Reusable logic to confirm a payment and decrement stock safely.
 * Used by verifyPayment (client-side) and handleRazorpayWebhook (server-side).
 */
export async function confirmOrderPayment(orderId: number, razorpayPaymentId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: { include: { product: true } } }
  });

  if (!order) throw createError(404, 'Order not found');
  if (order.status !== OrderStatus.PENDING) return; // Already processed

  await prisma.$transaction(async (tx) => {
    // 1. Mark Order as PAID
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, paymentId: razorpayPaymentId }
    });

    // 2. Atomic Stock Decrement with check
    for (const item of order.items) {
      if (item.productVariantId) {
        const update = await tx.productVariant.updateMany({
          where: { id: item.productVariantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (update.count === 0) {
          throw createError(400, `Insufficient stock for product variant in order #${order.id}`);
        }
      } else {
        const update = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (update.count === 0) {
          throw createError(400, `Insufficient stock for "${item.product.title}" in order #${order.id}`);
        }
      }
    }
  });

  // 3. Send Receipt (Async)
  sendOrderReceiptEmail(order.user.email, order.user.name, order, order.items).catch(err => {
    console.warn("[Order] Failed to send receipt email:", err.message);
  });
}
