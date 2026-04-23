import { v2 as cloudinary } from 'cloudinary';

/**
 * Safely removes an uploaded file from Cloudinary given its URL.
 * Silently ignores if the file does not exist or URL is missing.
 *
 * @param identifier - Either the Cloudinary public_id (preferred) or the full imageUrl
 */

// Ensure Cloudinary is configured
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function removeFile(identifier?: string | null): Promise<void> {
  if (!identifier) return;

  try {
    let publicId = identifier;

    // If it's a full URL, we need to extract the public_id
    // Example: https://res.cloudinary.com/cloudname/image/upload/v1/folder/sub/filename.jpg
    if (identifier.startsWith('http')) {
      const parts = identifier.split('/');
      const lastPart = parts.pop(); // filename.jpg
      if (!lastPart) return;

      const filename = lastPart.split('.')[0]; // filename
      
      // The public_id in Cloudinary includes all path segments after /upload/vxxxxxx/
      // and before the file extension.
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1 && parts.length > uploadIndex + 1) {
        // Skip 'upload' and the version (usually starts with 'v')
        const startIndex = parts[uploadIndex + 1].startsWith('v') ? uploadIndex + 2 : uploadIndex + 1;
        const pathSegments = parts.slice(startIndex);
        publicId = pathSegments.length > 0 
          ? `${pathSegments.join('/')}/${filename}`
          : filename;
      } else {
        // Fallback for simple structures
        publicId = filename;
      }
    }

    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok' && result.result !== 'not found') {
      console.warn(`[FileRemover] Cloudinary destroy returned status: ${result.result} for publicId: ${publicId}`);
    }
  } catch (err) {
    console.warn('[FileRemover] Error deleting file from Cloudinary:', identifier, err);
  }
}
