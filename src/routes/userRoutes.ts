import express from 'express';
import { authenticate } from '../middlewares/authMiddleware';
import {
  getAddresses, createAddress, updateAddress, deleteAddress
} from '../controllers/addressController';
import {
  getWishlist, toggleWishlist
} from '../controllers/wishlistController';

const router = express.Router();

router.use(authenticate);

// Addresses
router.get('/addresses', getAddresses);
router.post('/addresses', createAddress);
router.put('/addresses/:id', updateAddress);
router.delete('/addresses/:id', deleteAddress);

// Wishlist
router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', toggleWishlist);

export default router;
