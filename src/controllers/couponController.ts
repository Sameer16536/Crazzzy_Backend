import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';

// Admin creates coupon
export async function createCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, discountType, discountValue, expiresAt, usageLimit, isActive } = req.body;

    const existing = await prisma.coupon.findUnique({ where: { code }});
    if (existing) throw createError(409, 'Coupon code already exists');

    const coupon = await prisma.coupon.create({
      data: {
        code, discountType, discountValue, 
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        usageLimit, isActive: isActive ?? true
      }
    });

    res.status(201).json({ success: true, coupon });
  } catch(err) { next(err); }
}

// User validates coupon
export async function validateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, cartTotal } = req.body;
    if (!code) throw createError(400, 'Coupon code is required');

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    
    if (!coupon || !coupon.isActive) throw createError(400, 'Code is invalid or inactive');
    if (coupon.expiresAt && new Date() > coupon.expiresAt) throw createError(400, 'Code has expired');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw createError(400, 'Usage limit reached');

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (cartTotal * Number(coupon.discountValue)) / 100;
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    if (discountAmount > cartTotal) discountAmount = cartTotal;

    res.json({ 
      success: true, 
      coupon: { code: coupon.code, discountAmount, discountType: coupon.discountType, discountValue: coupon.discountValue }
    });
  } catch(err) { next(err); }
}

export async function listCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }});
    res.json({ success: true, coupons });
  } catch(err) { next(err); }
}
