import sharp from "sharp";

const MAX_FILE_SIZE_BEFORE_COMPRESSION = 10 * 1024 * 1024; // 10MB
const TARGET_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TARGET_MAX_FILE_SIZE_FOR_BASE64 = 3 * 1024 * 1024; // 3MB (becomes ~4MB in base64)

/**
 * Generate thumbnail URL from image URL
 * For Next.js Image component, we use quality and sizes props for optimization
 * This function returns the original URL - optimization is handled by Next.js Image component
 */
export const getThumbnailUrl = (originalUrl: string): string => {
  if (!originalUrl) return "";
  // Return original URL - Next.js Image will handle optimization with quality and sizes props
  return originalUrl;
};

/**
 * Get the original image URL for download
 */
export const getOriginalImageUrl = (url: string): string => {
  return url;
};

/**
 * Compress image if it's larger than 10MB to ensure it doesn't exceed 5MB
 * @param buffer - Image buffer to compress
 * @param mimeType - MIME type of the image (e.g., 'image/jpeg', 'image/png')
 * @param targetSize - Optional target size in bytes (default: 5MB)
 * @returns Compressed image buffer (or original if no compression needed)
 */
export async function compressImageIfNeeded(
  buffer: Buffer,
  mimeType: string,
  targetSize?: number
): Promise<Buffer> {
  const TARGET_SIZE = targetSize || TARGET_MAX_FILE_SIZE;
  // Check if file size is already below target, no compression needed
  if (buffer.length < TARGET_SIZE) {
    return buffer;
  }

  const originalSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  const targetSizeMB = (TARGET_SIZE / 1024 / 1024).toFixed(2);
  console.log(`Image is ${originalSizeMB}MB, compressing to max ${targetSizeMB}MB...`);

  try {
    const metadata = await sharp(buffer).metadata();
    
    // Determine output format based on input
    const outputFormat = mimeType.includes('png') ? 'png' : 
                        mimeType.includes('webp') ? 'webp' : 'jpeg';

    let currentBuffer = buffer;
    let quality = 85;
    let width = metadata.width || 1920;
    let height = metadata.height || 1080;
    let attempts = 0;
    const maxAttempts = 20; // Prevent infinite loops

    // Progressive compression: reduce quality first, then resize if needed
    while (currentBuffer.length > TARGET_SIZE && attempts < maxAttempts) {
      attempts++;
      let sharpInstance = sharp(currentBuffer === buffer ? buffer : currentBuffer);
      
      // If quality reduction didn't work and size is still too large, resize
      if (attempts > 5 && width > 800 && height > 600) {
        width = Math.floor(width * 0.9);
        height = Math.floor(height * 0.9);
        sharpInstance = sharp(buffer).resize(width, height, { 
          fit: 'inside', 
          withoutEnlargement: true 
        });
        console.log(`Resizing to ${width}x${height}px...`);
      }

      // Apply compression based on format
      if (outputFormat === 'jpeg') {
        currentBuffer = await sharpInstance
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
      } else if (outputFormat === 'png') {
        // PNG doesn't use quality in the same way, use compressionLevel
        currentBuffer = await sharpInstance
          .png({ compressionLevel: Math.min(9, Math.ceil((100 - quality) / 10)) })
          .toBuffer();
      } else {
        currentBuffer = await sharpInstance
          .webp({ quality })
          .toBuffer();
      }

      const currentSizeMB = (currentBuffer.length / 1024 / 1024).toFixed(2);
      
      // If still too large, reduce quality more aggressively
      if (currentBuffer.length > TARGET_SIZE && quality > 30) {
        quality -= attempts <= 3 ? 10 : 5;
        console.log(`Compressed to ${currentSizeMB}MB, reducing quality to ${quality}...`);
      } else if (currentBuffer.length <= TARGET_SIZE) {
        console.log(`✅ Compression complete: ${currentSizeMB}MB (was ${originalSizeMB}MB)`);
        break;
      }
    }

    // If still too large after all attempts, return the best compression we got
    if (currentBuffer.length > TARGET_SIZE) {
      const finalSizeMB = (currentBuffer.length / 1024 / 1024).toFixed(2);
      const targetSizeMBFinal = (TARGET_SIZE / 1024 / 1024).toFixed(2);
      console.log(`⚠️ Warning: Could not compress below ${targetSizeMBFinal}MB. Final size: ${finalSizeMB}MB`);
      // Try one last aggressive resize
      if (width > 640 && height > 480) {
        try {
          const finalBuffer = await sharp(buffer)
            .resize(640, 480, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 60, mozjpeg: true })
            .toBuffer();
          
          if (finalBuffer.length < currentBuffer.length) {
            return finalBuffer;
          }
        } catch (e) {
          // Ignore errors, use current buffer
        }
      }
    }

    return currentBuffer;
  } catch (error) {
    console.error("Error compressing image:", error);
    // Return original buffer if compression fails
    return buffer;
  }
}

