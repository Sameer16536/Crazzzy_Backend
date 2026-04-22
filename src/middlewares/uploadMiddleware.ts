import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024;

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'crazzzy_uploads',
    allowed_formats: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
  } as any,
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
});

export default upload;
