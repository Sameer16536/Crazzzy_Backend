import { Request, Response, NextFunction } from 'express';
import slugify from 'slugify';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/db';
import { createError } from '../middlewares/errorMiddleware';

export const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 100 }),
];

function validate(req: Request) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(422, errors.array()[0].msg);
  }
}

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });

    const formatted = categories.map(c => ({
      id: c.id, name: c.name, slug: c.slug,
      product_count: c._count.products
    }));

    res.json({ success: true, data: formatted });
  } catch (err) { next(err); }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const { name } = req.body;
    const slug = slugify(name, { lower: true, strict: true });

    const dup = await prisma.category.findUnique({ where: { slug } });
    if (dup) throw createError(409, 'Category already exists');

    const category = await prisma.category.create({ data: { name, slug } });
    res.status(201).json({ success: true, message: 'Category created', id: category.id, slug });
  } catch (err) { next(err); }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    validate(req);
    const categoryId = parseInt(req.params.id as string, 10);
    const { name } = req.body;
    const slug = slugify(name, { lower: true, strict: true });

    const existing = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!existing) throw createError(404, 'Category not found');

    const dup = await prisma.category.findFirst({ where: { slug, id: { not: categoryId } } });
    if (dup) throw createError(409, 'Another category with this name already exists');

    await prisma.category.update({ where: { id: categoryId }, data: { name, slug } });
    res.json({ success: true, message: 'Category updated' });
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = parseInt(req.params.id as string, 10);
    const existing = await prisma.category.findUnique({ 
      where: { id: categoryId },
      include: { _count: { select: { products: true } } }
    });

    if (!existing) throw createError(404, 'Category not found');

    if (existing._count.products > 0) {
      throw createError(400, `Cannot delete: ${existing._count.products} product(s) are assigned to this category`);
    }

    await prisma.category.delete({ where: { id: categoryId } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
}
