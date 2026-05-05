import multer from 'multer';

const MAX_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024;

// Using memory storage so we can process the image with sharp before uploading
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
});

export default upload;
