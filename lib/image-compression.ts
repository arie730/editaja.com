/**
 * Compress image in browser before upload to avoid 413 errors
 * Uses Canvas API for client-side compression
 */

const MAX_FILE_SIZE_FOR_UPLOAD = 3 * 1024 * 1024; // 3MB

/**
 * Compress image file in browser to reduce size before upload
 * @param file - Original image file
 * @param maxSizeMB - Maximum size in MB (default: 3MB)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Compressed File object
 */
export async function compressImageInBrowser(
  file: File,
  maxSizeMB: number = 3,
  quality: number = 0.8
): Promise<File> {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // If file is already small enough, return as-is
  if (file.size <= maxSizeBytes) {
    return file;
  }

  console.log(`Compressing image from ${(file.size / 1024 / 1024).toFixed(2)}MB to max ${maxSizeMB}MB...`);

  try {
    // Create image element from file
    const img = await createImageFromFile(file);
    
    // Get optimal dimensions
    const { width, height } = calculateOptimalDimensions(
      img.width,
      img.height,
      file.size,
      maxSizeBytes
    );

    // Create canvas and compress
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Draw image on canvas with optimal dimensions
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob with compression
    let currentQuality = quality;
    let blob: Blob | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    // Progressive compression: reduce quality until size is acceptable
    while (attempts < maxAttempts) {
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          file.type.includes("png") ? "image/png" : "image/jpeg",
          currentQuality
        );
      });

      if (!blob) {
        throw new Error("Failed to create compressed image");
      }

      // If size is acceptable or quality too low, stop
      if (blob.size <= maxSizeBytes || currentQuality <= 0.3) {
        break;
      }

      // Reduce quality for next attempt
      currentQuality -= 0.1;
      attempts++;
    }

    if (!blob) {
      throw new Error("Failed to compress image");
    }

    // If still too large, resize more aggressively
    if (blob.size > maxSizeBytes && attempts < maxAttempts) {
      const aggressiveWidth = Math.floor(width * 0.8);
      const aggressiveHeight = Math.floor(height * 0.8);

      canvas.width = aggressiveWidth;
      canvas.height = aggressiveHeight;
      ctx.drawImage(img, 0, 0, aggressiveWidth, aggressiveHeight);

      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          0.7
        );
      });
    }

    // Create new File from compressed blob
    const compressedFile = new File(
      [blob],
      file.name,
      {
        type: blob.type || "image/jpeg",
        lastModified: Date.now(),
      }
    );

    console.log(`✅ Compressed to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (was ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    return compressedFile;
  } catch (error) {
    console.error("Error compressing image in browser:", error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Create Image element from File
 */
function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Calculate optimal dimensions to achieve target file size
 */
function calculateOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  originalSize: number,
  targetSize: number
): { width: number; height: number } {
  // If already small enough, return original dimensions
  if (originalSize <= targetSize) {
    return { width: originalWidth, height: originalHeight };
  }

  // Calculate scale factor based on size ratio
  const sizeRatio = targetSize / originalSize;
  const scaleFactor = Math.sqrt(sizeRatio) * 0.95; // 0.95 for safety margin

  // Ensure minimum dimensions
  const minDimension = 640;

  let newWidth = Math.floor(originalWidth * scaleFactor);
  let newHeight = Math.floor(originalHeight * scaleFactor);

  // Maintain aspect ratio
  if (newWidth < minDimension && newHeight < minDimension) {
    if (originalWidth > originalHeight) {
      newWidth = minDimension;
      newHeight = Math.floor((minDimension / originalWidth) * originalHeight);
    } else {
      newHeight = minDimension;
      newWidth = Math.floor((minDimension / originalHeight) * originalWidth);
    }
  }

  // Ensure even dimensions for better compression
  newWidth = newWidth - (newWidth % 2);
  newHeight = newHeight - (newHeight % 2);

  return { width: newWidth, height: newHeight };
}

