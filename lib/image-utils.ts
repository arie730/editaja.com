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

