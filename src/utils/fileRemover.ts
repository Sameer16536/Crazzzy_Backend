import { v2 as cloudinary } from 'cloudinary';

/**
 * Safely removes an uploaded file from Cloudinary given its URL.
 * Silently ignores if the file does not exist or URL is missing.
 *
 * @param imageUrl  - Full Cloudinary URL
 */
export async function removeFile(imageUrl?: string | null): Promise<void> {
  if (!imageUrl) return;

  try {
    // A typical Cloudinary URL:
    // https://res.cloudinary.com/demo/image/upload/v1234/folder/filename.jpg
    
    const parts = imageUrl.split('/');
    const lastPart = parts.pop(); // filename.jpg
    if (!lastPart) return;

    const folder = parts.pop(); // folder
    const filename = lastPart.split('.')[0]; // filename without extension
    const publicId = `${folder}/${filename}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[FileRemover] Could not delete file from Cloudinary:', imageUrl, err);
  }
}
