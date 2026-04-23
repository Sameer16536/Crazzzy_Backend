import { Request, Response, NextFunction } from 'express';
import slugify from 'slugify';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';
import { removeFile } from '../utils/fileRemover';
import { Prisma } from '@prisma/client';

export const productCreateValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('originalPrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('categoryId').isInt({ min: 1 }).withMessage('Valid categoryId required'),
  body('description').optional({ nullable: true }).trim(),
  body('isFeatured').optional().isBoolean(),
  body('isDealOfTheDay').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
];

export const productUpdateValidation = [
  body('title').optional().trim().notEmpty().isLength({ max: 255 }),
  body('price').optional().isFloat({ min: 0 }),
  body('originalPrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('description').optional({ nullable: true }).trim(),
  body('isFeatured').optional().isBoolean(),
  body('isDealOfTheDay').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
];

function validate(req: Request) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(422, errors.array()[0].msg);
  }
}

function makeSlug(title: string) {
  return slugify(title, { lower: true, strict: true });
}

// Public API
export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (req.query.category) {
      where.category = { slug: req.query.category as string };
    }
    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } }
      ];
    }
    if (req.query.isFeatured) where.isFeatured = true;
    if (req.query.isDealOfTheDay) where.isDealOfTheDay = true;

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (req.query.sortBy === 'price_asc') orderBy = { price: 'asc' };
    if (req.query.sortBy === 'price_desc') orderBy = { price: 'desc' };
    if (req.query.sortBy === 'popularity') orderBy = { reviewCount: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit, orderBy,
        include: { category: true, images: true, variants: true }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      success: true,
      data: products,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
}

export async function getProductBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug as string },
      include: { category: true, images: true, variants: true, reviews: { include: { user: { select: { name: true } } } } }
    });

    if (!product || !product.isActive) throw createError(404, 'Product not found');
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

// Admin API
export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { title, description, price, originalPrice, stock, categoryId, isFeatured, isDealOfTheDay, isActive } = req.body;
    const slug = makeSlug(title);

    const dup = await prisma.product.findUnique({ where: { slug } });
    if (dup) throw createError(409, `A product with a similar title already exists (slug: ${slug})`);

    const imageUrl = req.file ? (req.file as any).path : null;
    
    // Multiple images
    const files = req.files as any[];
    const productImagesData = files?.map((f: any) => ({
      imageUrl: f.path,
      publicId: f.filename
    })) || [];

    const product = await prisma.product.create({
      data: {
        title, slug, description, stock: parseInt(stock), categoryId: parseInt(categoryId),
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        isDealOfTheDay: isDealOfTheDay === 'true' || isDealOfTheDay === true,
        isActive: isActive !== 'false',
        imageUrl: imageUrl || (productImagesData.length > 0 ? productImagesData[0].imageUrl : null),
        images: { create: productImagesData }
      }
    });

    res.status(201).json({ success: true, message: 'Product created', product });
  } catch(err) { next(err); }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const productId = parseInt(req.params.id as string, 10);
    const existing = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });
    
    if (!existing) throw createError(404, 'Product not found');

    const { title, description, price, originalPrice, stock, categoryId, isFeatured, isDealOfTheDay, isActive } = req.body;
    let slug = existing.slug;
    
    if (title && title !== existing.title) {
      slug = makeSlug(title);
    }

    let imageUrl = existing.imageUrl;
    const files = req.files as any[];
    const productImagesData = files?.map((f: any) => ({
      imageUrl: f.path,
      publicId: f.filename
    })) || [];

    // If new images are uploaded, update the main imageUrl to the first one of the new batch
    if (productImagesData.length > 0) {
      imageUrl = productImagesData[0].imageUrl;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        title, slug, description,
        price: price ? parseFloat(price) : undefined,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        stock: stock ? parseInt(stock) : undefined,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        isFeatured: isFeatured !== undefined ? (isFeatured === 'true' || isFeatured === true) : undefined,
        isDealOfTheDay: isDealOfTheDay !== undefined ? (isDealOfTheDay === 'true' || isDealOfTheDay === true) : undefined,
        isActive: isActive !== undefined ? (isActive !== 'false' && isActive !== false) : undefined,
        imageUrl,
        images: productImagesData.length > 0 ? {
          create: productImagesData
        } : undefined
      }
    });

    res.json({ success: true, message: 'Product updated', product });
  } catch(err) { next(err); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id as string, 10);
    const existing = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });
    if (!existing) throw createError(404, 'Product not found');

    if (existing.imageUrl) {
      await removeFile(existing.imageUrl).catch(() => {});
    }
    for (const img of existing.images) {
      await removeFile(img.publicId).catch(() => {});
    }

    await prisma.product.delete({ where: { id: productId } });
    res.json({ success: true, message: 'Product deleted' });
  } catch(err) { next(err); }
}
