import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';

// Fetch the user's cart
export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw createError(401, 'Unauthorized');

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            },
            variant: true,
          }
        }
      }
    });

    if (!cart) {
      return res.json({ success: true, cart: { items: [] } });
    }

    res.json({ success: true, cart });
  } catch (err) {
    next(err);
  }
}

// Merge local storage cart with database cart
export async function mergeCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw createError(401, 'Unauthorized');

    const { items } = req.body; // Array of { productId, variantId, quantity }
    if (!Array.isArray(items)) {
      throw createError(400, 'Items must be an array');
    }

    // Upsert the cart
    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // Process each local item
    for (const localItem of items) {
      const { productId, variantId, quantity } = localItem;
      const parsedProductId = parseInt(productId as string, 10);
      const parsedVariantId = variantId ? parseInt(variantId as string, 10) : null;

      // Check if product exists
      const product = await prisma.product.findUnique({ where: { id: parsedProductId } });
      if (!product || !product.isActive) continue;

      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: parsedProductId,
          productVariantId: parsedVariantId,
        }
      });

      if (existingItem) {
        // Increase quantity or set to local quantity depending on strategy. Let's just use local quantity since the user just logged in with it.
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: Math.max(existingItem.quantity, quantity) }
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: parsedProductId,
            productVariantId: parsedVariantId,
            quantity: quantity,
          }
        });
      }
    }

    // Fetch the updated cart
    const updatedCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { category: true }
            },
            variant: true,
          }
        }
      }
    });

    res.json({ success: true, cart: updatedCart });
  } catch (err) {
    next(err);
  }
}

// Update a specific item in the cart (Add/Update/Remove)
export async function updateCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw createError(401, 'Unauthorized');

    const { productId, variantId, quantity } = req.body;
    const parsedProductId = parseInt(productId as string, 10);
    const parsedVariantId = variantId ? parseInt(variantId as string, 10) : null;
    const parsedQuantity = parseInt(quantity as string, 10);

    if (isNaN(parsedProductId) || isNaN(parsedQuantity)) {
      throw createError(400, 'Invalid parameters');
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: parsedProductId,
        productVariantId: parsedVariantId,
      }
    });

    if (parsedQuantity <= 0) {
      if (existingItem) {
        await prisma.cartItem.delete({ where: { id: existingItem.id } });
      }
    } else {
      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: parsedQuantity }
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: parsedProductId,
            productVariantId: parsedVariantId,
            quantity: parsedQuantity,
          }
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Clear cart
export async function clearCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw createError(401, 'Unauthorized');

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// Sync cart (Full overwrite from frontend Redux state)
export async function syncCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) throw createError(401, 'Unauthorized');

    const { items } = req.body;
    if (!Array.isArray(items)) throw createError(400, 'Items must be an array');

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // 1. Wipe existing items
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    // 2. Insert new items
    for (const localItem of items) {
      const { productId, variantId, quantity } = localItem;
      const parsedProductId = parseInt(productId as string, 10);
      const parsedVariantId = variantId ? parseInt(variantId as string, 10) : null;
      
      if (isNaN(parsedProductId)) continue;

      const product = await prisma.product.findUnique({ where: { id: parsedProductId } });
      if (!product || !product.isActive) continue;

      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: parsedProductId,
          productVariantId: parsedVariantId,
          quantity: Math.max(1, quantity),
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
