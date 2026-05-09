import express from 'express'
import {
  getComboDeals, createComboDeal, updateComboDeal, deleteComboDeal,
  getCategoryFilters, setCategoryFilters,
  getCategoryOffers, createCategoryOffer, updateCategoryOffer, deleteCategoryOffer
} from '../controllers/adminSettingsController'
import { authenticate, requireAdmin } from '../middlewares/authMiddleware'

const router = express.Router()

// Public routes (anyone can view active deals, filters, and offers)
router.get('/combo-deals', getComboDeals)
router.get('/category-filters', getCategoryFilters)
router.get('/category-offers', getCategoryOffers)

// Admin only routes
router.use(authenticate, requireAdmin)

router.post('/combo-deals', createComboDeal)
router.put('/combo-deals/:id', updateComboDeal)
router.delete('/combo-deals/:id', deleteComboDeal)

router.post('/category-filters/:category', setCategoryFilters)

router.post('/category-offers', createCategoryOffer)
router.put('/category-offers/:id', updateCategoryOffer)
router.delete('/category-offers/:id', deleteCategoryOffer)

export default router
