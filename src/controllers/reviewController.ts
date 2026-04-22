import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';
import { OrderStatus } from '@prisma/client';

export async function addReview(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw createError(400, 'Rating must be between 1 and 5');
    }

    const product = await prisma.product.findUnique({ where: { id: productId }});
    if (!product) throw createError(404, 'Product not found');

    // ENFORCE VERIFIED PURCHASE
    const orderWithProduct = await prisma.order.findFirst({
      where: {
        userId: req.user!.id,
        status: OrderStatus.DELIVERED,
        items: { some: { productId } }
      }
    });

    if (!orderWithProduct) {
      throw createError(403, 'You can only review products you have purchased and received.');
    }

    // Upsert the review
    const existingReview = await prisma.review.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId } }
    });

    let review;
    if (existingReview) {
      review = await prisma.review.update({
        where: { id: existingReview.id },
        data: { rating, comment }
      });
    } else {
      review = await prisma.review.create({
        data: { userId: req.user!.id, productId, rating, comment }
      });
    }

    // Recalculate aggregation
    const agg = await prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { id: true }
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        ratingAvg: agg._avg.rating || 0,
        reviewCount: agg._count.id || 0
      }
    });

    res.json({ success: true, review, message: 'Review saved successfully' });
  } catch (err) { next(err); }
}

export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, reviews });
  } catch (err) { next(err); }
}
