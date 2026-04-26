import express from 'express';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';
import upload from '../middlewares/uploadMiddleware';

import {
  createProduct, updateProduct, deleteProduct, bulkProductUpdate, getProductById,
  productCreateValidation, productUpdateValidation,
} from '../controllers/productController';

import {
  createCategory, updateCategory, deleteCategory,
  categoryValidation,
} from '../controllers/categoryController';

import {
  getDashboardStats, listAllOrders, updateOrderStatus, listUsers,
  updateUserRole, updateUserBanStatus, deleteUser,
} from '../controllers/adminController';

import { createCoupon, listCoupons } from '../controllers/couponController';

const router = express.Router();

router.use(authenticate, requireAdmin);

// Standalone Image Upload (Returns Cloudinary details immediately)
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  res.json({
    success: true,
    imageUrl: (req.file as any).path,
    publicId: (req.file as any).filename
  });
});

router.get('/stats', getDashboardStats);

// Products (now supports multiple images array)
router.post('/products', upload.array('images', 5), productCreateValidation, createProduct);
router.patch('/products/bulk-update', bulkProductUpdate);
router.get('/products/:id', getProductById);
router.put('/products/:id', upload.array('images', 5), productUpdateValidation, updateProduct);
router.delete('/products/:id', deleteProduct);

// Categories
router.post('/categories', upload.single('image'), categoryValidation, createCategory);
router.put('/categories/:id', upload.single('image'), categoryValidation, updateCategory);
router.delete('/categories/:id', deleteCategory);

// Orders
router.get('/orders', listAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);

// Users
router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/ban', updateUserBanStatus);
router.delete('/users/:id', deleteUser);

// Coupons
router.post('/coupons', createCoupon);
router.get('/coupons', listCoupons);

export default router;
