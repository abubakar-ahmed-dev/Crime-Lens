/**
 * Thumbnail URL Utilities
 * Handles fallback logic for thumbnail URLs that may be missing .jpg extension
 */

/**
 * Ensures a thumbnail URL has proper .jpg extension for Cloudinary
 * @param thumbnailUrl - The original thumbnail URL from database
 * @returns URL with guaranteed .jpg extension
 */
export const normalizeThumbnailUrl = (thumbnailUrl: string | null | undefined): string | null => {
  if (!thumbnailUrl) return null;

  // If URL already ends with .jpg, return as is
  if (thumbnailUrl.endsWith('.jpg')) {
    return thumbnailUrl;
  }

  // Check if this looks like a Cloudinary URL without extension
  const cloudinaryPattern = /\/(image|video)\/upload\/.*\/([^\/]+)$/;
  const match = thumbnailUrl.match(cloudinaryPattern);

  if (match) {
    // Add .jpg extension to trigger proper Cloudinary transformation
    return `${thumbnailUrl}.jpg`;
  }

  // If not a Cloudinary URL or has other issues, return as is
  return thumbnailUrl;
};

/**
 * Gets a working thumbnail URL with multiple fallback strategies
 * @param media - Media object with thumbnailUrl, url, and publicId
 * @returns Working thumbnail URL
 */
export const getWorkingThumbnailUrl = (media: {
  thumbnailUrl?: string | null;
  url?: string;
  fileType?: string;
}): string => {
  // Try normalized thumbnail URL first
  const normalizedThumbnail = normalizeThumbnailUrl(media.thumbnailUrl || null);
  if (normalizedThumbnail) {
    return normalizedThumbnail;
  }

  // Fallback to full URL (will be larger but functional)
  if (media.url) {
    return media.url;
  }

  // Final fallback - empty string (component will show placeholder)
  return '';
};
