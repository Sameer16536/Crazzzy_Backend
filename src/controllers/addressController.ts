import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';

export async function getAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, addresses });
  } catch (err) { next(err); }
}

export async function createAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const { label, street, city, state, postalCode, country, isDefault } = req.body;
    
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: req.user!.id,
        label, street, city, state, postalCode, country,
        isDefault: isDefault || false
      }
    });

    res.status(201).json({ success: true, address });
  } catch(err) { next(err); }
}

export async function updateAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { label, street, city, state, postalCode, country, isDefault } = req.body;

    const existing = await prisma.address.findUnique({ where: { id }});
    if (!existing || existing.userId !== req.user!.id) {
       throw createError(404, 'Address not found');
    }

    if (isDefault && !existing.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: { label, street, city, state, postalCode, country, isDefault }
    });

    res.json({ success: true, address });
  } catch(err) { next(err); }
}

export async function deleteAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    const existing = await prisma.address.findUnique({ where: { id }});
    if (!existing || existing.userId !== req.user!.id) {
       throw createError(404, 'Address not found');
    }
    
    await prisma.address.delete({ where: { id }});
    res.json({ success: true, message: 'Address deleted' });
  } catch(err) { next(err); }
}
