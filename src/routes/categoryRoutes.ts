import express from 'express';
import { listCategories } from '../controllers/categoryController';

const router = express.Router();

router.get('/', listCategories);

export default router;
