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
 * Ensures a thumbnail URL is properly formatted
 * For Cloudinary URLs, we trust the backend SDK to generate correct URLs
 * For old-format URLs, use them as-is - they will work even without version
 * @param thumbnailUrl - The original thumbnail URL from database
 * @returns URL as-is if properly formatted, otherwise with minimal fixes
 */
export const normalizeThumbnailUrl = (thumbnailUrl: string | null | undefined): string | null => {
  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl INPUT:', thumbnailUrl);

  if (!thumbnailUrl) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: null/undefined input');
    return null;
  }

  // If not a Cloudinary URL, return as is
  if (!isCloudinaryUrl(thumbnailUrl)) {
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: not Cloudinary URL, returning as-is');
    return thumbnailUrl;
  }

  // For Cloudinary URLs, check if they already have a file extension
  // If they do, trust the backend and return as-is (even old formats work)
  const urlParts = thumbnailUrl.split('?');
  const baseUrl = urlParts[0];

  const lastSegment = baseUrl.split('/').pop() || '';
  const cleanLastSegment = lastSegment.split('?')[0];
  const hasExtension = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|svg)$/i.test(cleanLastSegment);

  if (hasExtension) {
    // URL has file extension - return as-is regardless of format
    // Old Cloudinary URLs without version component still work!
    if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: has extension, returning as-is');
    return thumbnailUrl;
  }

  if (DEBUG_THUMBNAILS) console.log('[Thumbnail] normalizeThumbnailUrl: no extension, returning original');
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

    // Cloudinary URL structure: ["", "cloud_name", "resource_type", "upload", "version", "path", "file.ext"]
    // Example: ["", "abubakar-ahmed-dev", "image", "upload", "v12345", "crimes", "temp", "image.jpg"]

    if (pathParts.length < 4) {
      if (DEBUG_THUMBNAILS) console.log('[Thumbnail] constructThumbnailFromFullUrl: path too short');
      return null;
    }

    // Extract components
    const cloudName = pathParts[1]; // e.g., "abubakar-ahmed-dev"

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

    // Build new URL with proper cloud_name: https://res.cloudinary.com/cloud_name/resource_type/upload/transformations/path
    const newUrl = `${url.protocol}//${url.host}/${cloudName}/${resourceType}/upload/${thumbnailTransformations}/${pathWithoutExtension}`;

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
