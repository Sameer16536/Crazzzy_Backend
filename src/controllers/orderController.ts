import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';
import { sendOrderReceiptEmail } from '../config/mail';
import { OrderStatus, DiscountType } from '@prisma/client';
import Razorpay from 'razorpay';

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
        include: { variants: true }
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
        price: price 
      });
    }

    let discountApplied = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon || !coupon.isActive) throw createError(400, 'Invalid coupon code');
      if (coupon.expiresAt && new Date() > coupon.expiresAt) throw createError(400, 'Coupon has expired');
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw createError(400, 'Coupon usage limit reached');

      if (coupon.discountType === DiscountType.PERCENTAGE) {
        discountApplied = (subtotal * Number(coupon.discountValue)) / 100;
      } else {
        discountApplied = Number(coupon.discountValue);
      }
      if (discountApplied > subtotal) discountApplied = subtotal;
    }

    const totalAmount = subtotal - discountApplied;
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

    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpay_signature)
    );

    if (!signaturesMatch) throw createError(400, 'Payment verification failed: Invalid signature');

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, paymentId: razorpay_payment_id }
      });

      for (const item of order.items) {
        if (item.productVariantId) {
          // Decrement Variant Stock
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { decrement: item.quantity } }
          });
        } else {
          // Decrement Base Product Stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
        }
      }
    });

    sendOrderReceiptEmail(order.user.email, order.user.name, order, order.items).catch(err => {
      console.warn("Failed to send order email:", err);
    });

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
