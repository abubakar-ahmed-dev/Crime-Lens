/**
 * Thumbnail URL Utilities
 * Handles fallback logic for thumbnail URLs that may be missing .jpg extension
 */

/**
 * Checks if a URL is a Cloudinary URL
 * @param url - URL to check
 * @returns true if Cloudinary URL
 */
const isCloudinaryUrl = (url: string): boolean => {
  return url.includes('cloudinary.com') && (url.includes('/image/upload/') || url.includes('/video/upload/'));
};

/**
 * Ensures a thumbnail URL has proper .jpg extension for Cloudinary
 * Handles folder paths and various URL formats
 * @param thumbnailUrl - The original thumbnail URL from database
 * @returns URL with guaranteed .jpg extension
 */
export const normalizeThumbnailUrl = (thumbnailUrl: string | null | undefined): string | null => {
  if (!thumbnailUrl) return null;

  // If URL already ends with .jpg, return as is
  if (thumbnailUrl.endsWith('.jpg')) {
    return thumbnailUrl;
  }

  // If not a Cloudinary URL, return as is
  if (!isCloudinaryUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }

  // For Cloudinary URLs, ensure .jpg extension
  // Handle URLs with folder paths like: crimes/123/filename
  const cloudinaryPattern = /\/(image|video)\/upload\/(.*)$/;
  const match = thumbnailUrl.match(cloudinaryPattern);

  if (match) {
    const transformationsAndPath = match[2];

    // Check if the last segment already has a file extension
    const lastSegment = transformationsAndPath.split('/').pop() || '';
    const hasExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(lastSegment);

    if (!hasExtension) {
      // Add .jpg extension for proper Cloudinary transformation
      return `${thumbnailUrl}.jpg`;
    }
  }

  return thumbnailUrl;
};

/**
 * Constructs a proper thumbnail URL from a full Cloudinary media URL
 * @param fullUrl - Full media URL
 * @param fileType - 'image' or 'video'
 * @returns Thumbnail URL with proper transformations, or null if failed
 */
const constructThumbnailFromFullUrl = (fullUrl: string, fileType?: string): string | null => {
  if (!fullUrl || !isCloudinaryUrl(fullUrl)) {
    return null;
  }

  try {
    // Parse Cloudinary URL
    const url = new URL(fullUrl);
    const pathParts = url.pathname.split('/');

    // Find the index of 'upload' in the path
    const uploadIndex = pathParts.findIndex(part => part === 'upload');

    if (uploadIndex === -1 || uploadIndex + 1 >= pathParts.length) {
      return null; // Can't parse
    }

    // Extract the resource path (everything after 'upload/')
    const resourcePath = pathParts.slice(uploadIndex + 1).join('/');

    // Remove file extension if present
    const pathWithoutExtension = resourcePath.replace(/\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i, '');

    // Construct thumbnail URL with transformations
    const thumbnailTransformations = 'c_fill,g_auto,h_200,q_auto,w_200';
    const resourceType = fileType === 'video' ? 'video' : 'image';

    // Build new URL: https://cloudinary.com/cloud_name/resource_type/upload/transformations/path.jpg
    const newUrl = `${url.protocol}//${url.host}/${resourceType}/upload/${thumbnailTransformations}/${pathWithoutExtension}.jpg`;

    return newUrl;
  } catch (error) {
    // Silently fail - this is a fallback function
    return null;
  }
};

/**
 * Gets a working thumbnail URL with multiple fallback strategies
 * @param media - Media object with thumbnailUrl, url, and fileType
 * @returns Working thumbnail URL (never null)
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

  // Fallback: construct thumbnail from full URL
  if (media.url) {
    const constructedThumbnail = constructThumbnailFromFullUrl(media.url, media.fileType);
    if (constructedThumbnail) {
      return constructedThumbnail;
    }
    // If construction failed, use the original URL
    return media.url;
  }

  // Final fallback - empty string (component will show placeholder)
  return '';
};
