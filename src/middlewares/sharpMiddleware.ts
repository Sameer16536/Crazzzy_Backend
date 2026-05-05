import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Ensure Cloudinary is configured
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a buffer to Cloudinary using a stream.
 */
const uploadFromBuffer = (buffer: Buffer, folder: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        format: 'webp', // Redundant but good for safety
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

/**
 * Middleware to process uploaded images with Sharp and upload to Cloudinary.
 * This converts images to WebP locally to save Cloudinary credits.
 */
export const processAndUploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folder = 'crazzzy_uploads';

    // Handle single file (upload.single)
    if (req.file) {
      const processedBuffer = await sharp(req.file.buffer)
        .webp({ quality: 80 })
        .toBuffer();

      const result = await uploadFromBuffer(processedBuffer, folder);
      
      // Update req.file to match what the controller expects
      (req.file as any).path = result.secure_url;
      (req.file as any).filename = result.public_id;
    }

    // Handle multiple files (upload.array)
    if (req.files && Array.isArray(req.files)) {
      const files = req.files as Express.Multer.File[];
      const uploadPromises = files.map(async (file) => {
        const processedBuffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();

        const result = await uploadFromBuffer(processedBuffer, folder);
        
        // Update file object properties
        (file as any).path = result.secure_url;
        (file as any).filename = result.public_id;
        return result;
      });

      await Promise.all(uploadPromises);
    }

    next();
  } catch (error) {
    console.error('[SharpMiddleware] Error processing images:', error);
    next(error);
  }
};
