import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';
import { OrderStatus, Role } from '@prisma/client';
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '../config/mail';

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [revenueObj, totalOrders, totalUsers, recentOrders] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED] } },
        _sum: { totalAmount: true }
      }),
      prisma.order.count(),
      prisma.user.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: revenueObj._sum.totalAmount || 0,
        totalOrders,
        totalUsers,
        recentOrders,
      },
    });
  } catch (err) { next(err); }
}

export async function listAllOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;
    const status = req.query.status as OrderStatus | undefined;

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip, take: limit,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      success: true,
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = parseInt(req.params.id as string, 10);
    const { status, trackingNumber, courierName, estimatedDelivery } = req.body;
    
    if (status && !Object.values(OrderStatus).includes(status)) {
      throw createError(400, `Invalid status`);
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw createError(404, 'Order not found');

    const updateData: any = {};
    if (status) updateData.status = status;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (courierName !== undefined) updateData.courierName = courierName;
    if (estimatedDelivery !== undefined) updateData.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null;
    
    // Auto-set deliveredAt if status is changed to DELIVERED
    if (status === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { user: true }
    });

    // --- Amazon-like Automation Triggers ---
    if (status === OrderStatus.SHIPPED) {
      sendOrderShippedEmail(updatedOrder.user.email, updatedOrder.user.name, updatedOrder).catch(console.error);
    } else if (status === OrderStatus.DELIVERED) {
      sendOrderDeliveredEmail(updatedOrder.user.email, updatedOrder.user.name, updatedOrder).catch(console.error);
    }

    res.json({ success: true, message: `Order status updated to "${status}"`, order: updatedOrder });
  } catch (err) { next(err); }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, role: true, isVerified: true, createdAt: true }
      }),
      prisma.user.count()
    ]);

    res.json({
      success: true,
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { role } = req.body;
    
    if (!Object.values(Role).includes(role)) throw createError(400, 'Invalid Role');
    if (userId === req.user!.id && role === Role.USER) throw createError(403, 'You cannot demote yourself');

    const result = await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (err) { next(err); }
}

export async function updateUserBanStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string, 10);
    const { isBanned } = req.body;
    
    if (typeof isBanned !== 'boolean') throw createError(400, 'isBanned must be a boolean');
    if (userId === req.user!.id) throw createError(403, 'You cannot ban yourself');

    await prisma.user.update({
      where: { id: userId },
      data: { isBanned }
    });

    if (isBanned) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    res.json({ success: true, message: `User has been ${isBanned ? 'banned' : 'unbanned'}` });
  } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id as string, 10);
    if (userId === req.user!.id) throw createError(403, 'You cannot delete yourself');

    await prisma.user.delete({ where: { id: userId } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) { next(err); }
}
