import { Request, Response } from 'express'
import prisma from '../config/prisma'

export const getComboDeals = async (req: Request, res: Response) => {
  try {
    const deals = await prisma.comboDeal.findMany({ order: { createdAt: 'desc' } })
    const parsedDeals = deals.map(d => ({
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
    filters.forEach(f => {
      map[f.category] = JSON.parse(f.tags)
    })
    res.json(map)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const setCategoryFilters = async (req: Request, res: Response) => {
  try {
    const { category } = req.params
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
