import { Request, Response } from 'express'
import { prisma } from '../config/db'

export const getComboDeals = async (req: Request, res: Response) => {
  try {
    const deals = await prisma.comboDeal.findMany({ orderBy: { createdAt: 'desc' } })
    const parsedDeals = deals.map((d: any) => ({
      ...d,
      bundlePrice: Number(d.bundlePrice),
      eligibleProductIds: JSON.parse(d.eligibleProductIds)
    }))
    res.json(parsedDeals)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createComboDeal = async (req: Request, res: Response) => {
  try {
    const { title, description, requiredQuantity, bundlePrice, eligibleProductIds, isActive } = req.body
    const deal = await prisma.comboDeal.create({
      data: {
        title,
        description,
        requiredQuantity: Number(requiredQuantity),
        bundlePrice: Number(bundlePrice),
        eligibleProductIds: JSON.stringify(eligibleProductIds || []),
        isActive: Boolean(isActive)
      }
    })
    res.status(201).json({
      ...deal,
      bundlePrice: Number(deal.bundlePrice),
      eligibleProductIds: JSON.parse(deal.eligibleProductIds)
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateComboDeal = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = req.body
    
    // Convert array to JSON string if present
    if (data.eligibleProductIds) {
      data.eligibleProductIds = JSON.stringify(data.eligibleProductIds)
    }
    if (data.bundlePrice !== undefined) {
      data.bundlePrice = Number(data.bundlePrice)
    }

    const deal = await prisma.comboDeal.update({
      where: { id: Number(id) },
      data
    })
    res.json({
      ...deal,
      bundlePrice: Number(deal.bundlePrice),
      eligibleProductIds: JSON.parse(deal.eligibleProductIds)
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteComboDeal = async (req: Request, res: Response) => {
  try {
    await prisma.comboDeal.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getCategoryFilters = async (req: Request, res: Response) => {
  try {
    const filters = await prisma.categoryFilter.findMany()
    const map: Record<string, string[]> = {}
    filters.forEach((f: any) => {
      map[f.category] = JSON.parse(f.tags)
    })
    res.json(map)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const setCategoryFilters = async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string
    const { tags } = req.body
    
    await prisma.categoryFilter.upsert({
      where: { category },
      update: { tags: JSON.stringify(tags) },
      create: { category, tags: JSON.stringify(tags) }
    })
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getCategoryOffers = async (req: Request, res: Response) => {
  try {
    const offers = await prisma.categoryOffer.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(offers)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createCategoryOffer = async (req: Request, res: Response) => {
  try {
    const { categorySlug, buyQuantity, getQuantity, isActive } = req.body
    const offer = await prisma.categoryOffer.create({
      data: {
        categorySlug,
        buyQuantity: Number(buyQuantity),
        getQuantity: Number(getQuantity),
        isActive: Boolean(isActive)
      }
    })
    res.status(201).json(offer)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateCategoryOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const offer = await prisma.categoryOffer.update({
      where: { id: Number(id) },
      data: req.body
    })
    res.json(offer)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteCategoryOffer = async (req: Request, res: Response) => {
  try {
    await prisma.categoryOffer.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getProductOffers = async (req: Request, res: Response) => {
  try {
    const offers = await prisma.productOffer.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { title: true, imageUrl: true } } }
    })
    res.json(offers)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createProductOffer = async (req: Request, res: Response) => {
  try {
    const { productId, buyQuantity, freeProductIds, isActive } = req.body
    
    // Check if offer already exists for this product (unique constraint)
    const existing = await prisma.productOffer.findUnique({
      where: { productId: Number(productId) }
    })
    if (existing) {
      return res.status(400).json({ success: false, error: 'An offer already exists for this trigger product' })
    }

    const offer = await prisma.productOffer.create({
      data: {
        productId: Number(productId),
        buyQuantity: Number(buyQuantity),
        freeProductIds: typeof freeProductIds === 'string' ? freeProductIds : JSON.stringify(freeProductIds),
        isActive: Boolean(isActive)
      },
      include: { product: { select: { title: true, imageUrl: true } } }
    })
    res.status(201).json(offer)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateProductOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { productId, buyQuantity, freeProductIds, isActive } = req.body
    
    const updateData: any = {}
    if (productId !== undefined) updateData.productId = Number(productId)
    if (buyQuantity !== undefined) updateData.buyQuantity = Number(buyQuantity)
    if (freeProductIds !== undefined) {
      updateData.freeProductIds = typeof freeProductIds === 'string' ? freeProductIds : JSON.stringify(freeProductIds)
    }
    if (isActive !== undefined) updateData.isActive = Boolean(isActive)

    const offer = await prisma.productOffer.update({
      where: { id: Number(id) },
      data: updateData,
      include: { product: { select: { title: true, imageUrl: true } } }
    })
    res.json(offer)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteProductOffer = async (req: Request, res: Response) => {
  try {
    await prisma.productOffer.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}
