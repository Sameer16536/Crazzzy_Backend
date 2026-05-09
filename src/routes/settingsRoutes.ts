import express from 'express'
import { authenticate, requireAdmin } from '../middlewares/authMiddleware'
import {
  getComboDeals, createComboDeal, updateComboDeal, deleteComboDeal,
  getCategoryFilters, setCategoryFilters
} from '../controllers/adminSettingsController'

const router = express.Router()

// Public routes (anyone can view active deals and filters)
router.get('/combo-deals', getComboDeals)
router.get('/category-filters', getCategoryFilters)

// Admin only routes
router.use(authenticate, requireAdmin)

router.post('/combo-deals', createComboDeal)
router.put('/combo-deals/:id', updateComboDeal)
router.delete('/combo-deals/:id', deleteComboDeal)

router.post('/category-filters/:category', setCategoryFilters)

export default router
