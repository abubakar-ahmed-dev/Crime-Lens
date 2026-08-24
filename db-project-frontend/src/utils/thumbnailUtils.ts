/**
 * Thumbnail URL Utilities
 * Handles fallback logic for thumbnail URLs that may be missing .jpg extension
 */

// Debug mode for thumbnail troubleshooting
const DEBUG_THUMBNAILS = true;

/**
 * Checks if a URL is a Cloudinary URL
 * @param url - URL to check
 * @returns true if Cloudinary URL
 */
const isCloudinaryUrl = (url: string): boolean => {
  const result = url.includes('cloudinary.com') && (url.includes('/image/upload/') || url.includes('/video/upload/'));
  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] isCloudinaryUrl:', url, '→', result);
  return result;
};

/**
 * Ensures a thumbnail URL has proper .jpg extension for Cloudinary
 * Handles folder paths and various URL formats
 * @param thumbnailUrl - The original thumbnail URL from database
 * @returns URL with guaranteed .jpg extension
 */
export const normalizeThumbnailUrl = (thumbnailUrl: string | null | undefined): string | null => {
  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl INPUT:', thumbnailUrl);

  if (!thumbnailUrl) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: null/undefined input');
    return null;
  }

  // If URL already ends with .jpg, return as is
  if (thumbnailUrl.endsWith('.jpg')) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: already has .jpg');
    return thumbnailUrl;
  }

  // If not a Cloudinary URL, return as is
  if (!isCloudinaryUrl(thumbnailUrl)) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: not Cloudinary URL');
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
      const result = `${thumbnailUrl}.jpg`;
      if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: added .jpg →', result);
      return result;
    }
  }

  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: returning original →', thumbnailUrl);
  return thumbnailUrl;
};

/**
 * Constructs a proper thumbnail URL from a full Cloudinary media URL
 * @param fullUrl - Full media URL
 * @param fileType - 'image' or 'video'
 * @returns Thumbnail URL with proper transformations, or null if failed
 */
const constructThumbnailFromFullUrl = (fullUrl: string, fileType?: string): string | null => {
  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] constructThumbnailFromFullUrl INPUT:', { fullUrl, fileType });

  if (!fullUrl || !isCloudinaryUrl(fullUrl)) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] constructThumbnailFromFullUrl: invalid input');
    return null;
  }

  try {
    // Parse Cloudinary URL
    const url = new URL(fullUrl);
    const pathParts = url.pathname.split('/');

    // Find the index of 'upload' in the path
    const uploadIndex = pathParts.findIndex(part => part === 'upload');

    if (uploadIndex === -1 || uploadIndex + 1 >= pathParts.length) {
      if (DEBUG_THUMBNAILS) console.log('[Thumbnail] constructThumbnailFromFullUrl: could not find upload in path');
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

    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] constructThumbnailFromFullUrl SUCCESS →', newUrl);
    return newUrl;
  } catch (error) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] constructThumbnailFromFullUrl ERROR:', error);
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
  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] getWorkingThumbnailUrl INPUT:', JSON.stringify(media));

  // Try normalized thumbnail URL first
  const normalizedThumbnail = normalizeThumbnailUrl(media.thumbnailUrl || null);
  if (normalizedThumbnail) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] getWorkingThumbnailUrl → using normalized thumbnail');
    return normalizedThumbnail;
  }

  // Fallback: construct thumbnail from full URL
  if (media.url) {
    const constructedThumbnail = constructThumbnailFromFullUrl(media.url, media.fileType);
    if (constructedThumbnail) {
      if (DEBUG_THUMBNAILS) console.log('[Thumbnail] getWorkingThumbnailUrl → using constructed thumbnail');
      return constructedThumbnail;
    }
    // If construction failed, use the original URL
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] getWorkingThumbnailUrl → using original URL as fallback');
    return media.url;
  }

  // Final fallback - empty string (component will show placeholder)
  if (DEBUG_THUMBNAILS) console.warn('[Thumbnail] getWorkingThumbnailUrl → NO URL AVAILABLE, returning empty string');
  return '';
};
