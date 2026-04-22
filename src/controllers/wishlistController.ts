import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';

export async function getWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        wishlisted: {
          include: { images: true }
        }
      }
    });

    res.json({ success: true, wishlist: user?.wishlisted || [] });
  } catch (err) { next(err); }
}

export async function toggleWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    
    const product = await prisma.product.findUnique({ where: { id: productId }});
    if (!product) throw createError(404, 'Product not found');

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { wishlisted: { where: { id: productId } } }
    });

    if (user && user.wishlisted.length > 0) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { wishlisted: { disconnect: { id: productId } } }
      });
      res.json({ success: true, message: 'Removed from wishlist', action: 'removed' });
    } else {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { wishlisted: { connect: { id: productId } } }
      });
      res.json({ success: true, message: 'Added to wishlist', action: 'added' });
    }
  } catch (err) { next(err); }
}
