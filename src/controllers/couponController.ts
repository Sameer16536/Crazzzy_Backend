import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';

// Admin creates coupon
export async function createCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, discountType, discountValue, expiresAt, usageLimit, isActive } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw createError(422, 'Coupon code is required');
    }
    if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
      throw createError(422, 'discountType must be PERCENTAGE or FIXED');
    }
    const parsedValue = parseFloat(discountValue);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      throw createError(422, 'discountValue must be a positive number');
    }
    if (discountType === 'PERCENTAGE' && parsedValue > 100) {
      throw createError(422, 'Percentage discount cannot exceed 100%');
    }

    const existing = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() }});
    if (existing) throw createError(409, 'Coupon code already exists');

    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: parsedValue,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        isActive: isActive ?? true
      }
    });

    res.status(201).json({ success: true, coupon });
  } catch(err) { next(err); }
}

export async function updateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const couponId = parseInt(req.params.id as string, 10);
    if (isNaN(couponId)) throw createError(400, 'Invalid coupon ID');

    const existing = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!existing) throw createError(404, 'Coupon not found');

    const { code, discountType, discountValue, expiresAt, usageLimit, isActive } = req.body;

    // Check code uniqueness if changing code
    if (code && code !== existing.code) {
      const dup = await prisma.coupon.findUnique({ where: { code } });
      if (dup) throw createError(409, 'Coupon code already exists');
    }

    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        code, 
        discountType, 
        discountValue: discountValue ? Number(discountValue) : undefined, 
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null, 
        isActive
      }
    });

    res.json({ success: true, coupon: updated });
  } catch(err) { next(err); }
}

export async function deleteCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const couponId = parseInt(req.params.id as string, 10);
    if (isNaN(couponId)) throw createError(400, 'Invalid coupon ID');

    const existing = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!existing) throw createError(404, 'Coupon not found');

    await prisma.coupon.delete({ where: { id: couponId } });

    res.json({ success: true, message: 'Coupon deleted successfully' });
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
