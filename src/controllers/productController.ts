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

const parseTags = (tagString: string) => {
  if (!tagString) return [];
  return tagString.split(/[#\s,]+/).filter(t => t.length > 0).map(t => t.toLowerCase());
};

// Public API
export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const { search, category, isFeatured, isDealOfTheDay } = req.query;

    const isAdmin = req.user?.role === 'ADMIN';

    const where: Prisma.ProductWhereInput = {
      // Only force isActive=true for normal users
      ...(isAdmin ? {} : { isActive: true }),
      AND: [
        // Logic: Search in Title OR Description OR Category Name
        search ? {
          OR: [
            { title: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } },
            { category: { name: { contains: search as string, mode: 'insensitive' } } },
            { tags: { some: { name: { contains: (search as string).replace('#', ''), mode: 'insensitive' } } } },
            ...(!isNaN(parseInt(search as string, 10)) ? [{ id: parseInt(search as string, 10) }] : [])
          ]
        } : {},

        // Logic: Filter by Category or Sub-category
        category ? {
          category: {
            OR: [
              { slug: category as string },
              { parent: { slug: category as string } }
            ]
          }
        } : {},

        // Keep additional flags
        isFeatured ? { isFeatured: true } : {},
        isDealOfTheDay ? { isDealOfTheDay: true } : {},
      ]
    };

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
    const slugOrId = req.params.slug as string;
    const isId = !isNaN(parseInt(slugOrId, 10)) && /^\d+$/.test(slugOrId);

    const product = await prisma.product.findUnique({
      where: isId ? { id: parseInt(slugOrId, 10) } : { slug: slugOrId },
      include: { 
        category: true, 
        images: true, 
        variants: true, 
        tags: true,
        reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } 
      }
    });

    if (!product || (!product.isActive && req.user?.role !== 'ADMIN')) {
      throw createError(404, 'Product not found');
    }
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
}

// Admin: Get a single product by numeric ID (bypasses isActive check)
export async function getProductById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) throw createError(400, 'Invalid product ID');

    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, images: true, variants: true, tags: true, reviews: true }
    });

    if (!product) throw createError(404, 'Product not found');
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
    const mainPublicId = req.file ? (req.file as any).filename : null;

    // Multiple images
    const files = req.files as any[];
    const productImagesData = files?.map((f: any) => ({
      imageUrl: f.path,
      publicId: f.filename
    })) || [];

    // Tags & Variants logic
    const tagNames = parseTags(req.body.tags);
    const variantsData = req.body.variants ? (typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants) : [];

    const product = await prisma.product.create({
      data: {
        title, slug, description, stock: parseInt(stock), categoryId: parseInt(categoryId),
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        isDealOfTheDay: isDealOfTheDay === 'true' || isDealOfTheDay === true,
        isActive: isActive !== 'false',
        imageUrl: imageUrl || (productImagesData.length > 0 ? productImagesData[0].imageUrl : null),
        publicId: mainPublicId || (productImagesData.length > 0 ? productImagesData[0].publicId : null),
        images: { create: productImagesData },
        variants: {
          create: variantsData.map((v: any) => ({
            variantName: v.variantName,
            additionalPrice: v.additionalPrice ? parseFloat(v.additionalPrice) : 0,
            stock: v.stock ? parseInt(v.stock) : 0
          }))
        },
        tags: {
          connectOrCreate: tagNames.map(name => ({
            where: { name },
            create: { name }
          }))
        }
      }
    });

    res.status(201).json({ success: true, message: 'Product created', product });
  } catch (err) { next(err); }
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
    let mainPublicId = existing.publicId;

    const files = req.files as any[];
    const productImagesData = files?.map((f: any) => ({
      imageUrl: f.path,
      publicId: f.filename
    })) || [];

    // If new images are uploaded, update the main imageUrl to the first one of the new batch
    if (productImagesData.length > 0) {
      imageUrl = productImagesData[0].imageUrl;
      mainPublicId = productImagesData[0].publicId;
    }

    // Tags & Variants logic
    const tagNames = req.body.tags !== undefined ? parseTags(req.body.tags) : undefined;
    const variantsData = req.body.variants !== undefined ? (typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants) : undefined;

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
        publicId: mainPublicId,
        images: productImagesData.length > 0 ? {
          create: productImagesData
        } : undefined,
        variants: variantsData !== undefined ? {
          deleteMany: {}, // Clear and recreate variants
          create: variantsData.map((v: any) => ({
            variantName: v.variantName,
            additionalPrice: v.additionalPrice ? parseFloat(v.additionalPrice) : 0,
            stock: v.stock ? parseInt(v.stock) : 0
          }))
        } : undefined,
        tags: tagNames !== undefined ? {
          set: [], 
          connectOrCreate: tagNames.map(name => ({
            where: { name },
            create: { name }
          }))
        } : undefined
      }
    });

    res.json({ success: true, message: 'Product updated', product });
  } catch (err) { next(err); }
}

export async function bulkProductUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const updates = req.body.updates; // Expecting array of { id, title, price, tags, stock }
    if (!Array.isArray(updates)) throw createError(400, 'Updates must be an array');

    const results = await Promise.all(updates.map(async (u: any) => {
      const tagNames = u.tags !== undefined ? parseTags(u.tags) : undefined;
      return prisma.product.update({
        where: { id: parseInt(u.id) },
        data: {
          title: u.title,
          price: u.price ? parseFloat(u.price) : undefined,
          stock: u.stock !== undefined ? parseInt(u.stock) : undefined,
          tags: tagNames !== undefined ? {
            set: [],
            connectOrCreate: tagNames.map(name => ({
              where: { name },
              create: { name }
            }))
          } : undefined
        }
      });
    }));

    res.json({ success: true, message: `${results.length} products updated`, results });
  } catch (err) { next(err); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = parseInt(req.params.id as string, 10);
    const existing = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });
    if (!existing) throw createError(404, 'Product not found');

    if (existing.publicId) {
      await removeFile(existing.publicId).catch(() => { });
    } else if (existing.imageUrl) {
      // Fallback for legacy data without publicId
      await removeFile(existing.imageUrl).catch(() => { });
    }
    for (const img of existing.images) {
      await removeFile(img.publicId).catch(() => { });
    }

    await prisma.product.delete({ where: { id: productId } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
}
