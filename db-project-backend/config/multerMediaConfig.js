import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// Multer Configuration for Media Upload (Images & Videos)
// ============================================================================
// Purpose: Handle multipart/form-data uploads for crime report media files
//
// Features:
// - Memory storage (files buffered for Cloudinary upload)
// - File type validation (images: jpg, png, gif, webp; videos: mp4, mov, webm)
// - File size validation (max 5MB per file)
// - Comprehensive error handling
// ============================================================================

// File type validation - Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  // Videos
  "video/mp4",
  "video/quicktime", // .mov files
  "video/webm",
];

// File extensions mapping for additional validation
const ALLOWED_EXTENSIONS = [
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  // Videos
  ".mp4",
  ".mov",
  ".webm",
];

// Maximum file size (5MB as specified in requirements)
const MAX_FILE_SIZE = parseInt(process.env.MAX_MEDIA_FILE_SIZE) || 5 * 1024 * 1024; // 5MB in bytes

// ============================================================================
// FILE FILTER FUNCTION
// ============================================================================

const fileFilter = (req, file, cb) => {
  // Check if file MIME type is allowed
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      `Invalid file type: ${file.mimetype}. ` +
      `Allowed types: Images (${ALLOWED_MIME_TYPES.slice(0, 5).join(", ")}) ` +
      `and Videos (${ALLOWED_MIME_TYPES.slice(5).join(", ")})`
    );
    error.code = "LIMIT_FILE_TYPE";
    cb(error, false);
  }
};

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory for Cloudinary upload
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Maximum total files (5 images + 2 videos + buffer)
  },
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate file count limits
 * @param {Array} files - Array of uploaded files
 * @returns {Object} Validation result with valid flag and message
 */
export const validateFileCount = (files) => {
  if (!files || files.length === 0) {
    return { valid: true, message: "No files provided (optional field)" };
  }

  const images = files.filter((file) => file.mimetype.startsWith("image/"));
  const videos = files.filter((file) => file.mimetype.startsWith("video/"));

  const maxImages = parseInt(process.env.MAX_IMAGE_COUNT) || 5;
  const maxVideos = parseInt(process.env.MAX_VIDEO_COUNT) || 2;

  if (images.length > maxImages) {
    return {
      valid: false,
      message: `Maximum ${maxImages} images allowed. You uploaded ${images.length} images.`,
    };
  }

  if (videos.length > maxVideos) {
    return {
      valid: false,
      message: `Maximum ${maxVideos} videos allowed. You uploaded ${videos.length} videos.`,
    };
  }

  return {
    valid: true,
    message: `File count valid: ${images.length} images, ${videos.length} videos`,
  };
};

/**
 * Validate individual file size
 * @param {Object} file - Uploaded file object
 * @returns {Object} Validation result
 */
export const validateFileSize = (file) => {
  if (!file) {
    return { valid: false, message: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    };
  }

  return { valid: true, message: "File size valid" };
};

/**
 * Get file category (image or video)
 * @param {string} mimeType - MIME type of the file
 * @returns {string} 'image' or 'video'
 */
export const getFileCategory = (mimeType) => {
  if (mimeType.startsWith("image/")) {
    return "image";
  } else if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "unknown";
};

// ============================================================================
// ERROR HANDLER
// ============================================================================

/**
 * Handle multer errors and return user-friendly messages
 * @param {Error} error - Multer error
 * @returns {Object} Formatted error response
 */
export const handleMulterError = (error) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return {
      success: false,
      message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
      code: "FILE_TOO_LARGE",
    };
  }

  if (error.code === "LIMIT_FILE_TYPE") {
    return {
      success: false,
      message: error.message,
      code: "INVALID_FILE_TYPE",
    };
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return {
      success: false,
      message: "Unexpected file field",
      code: "UNEXPECTED_FIELD",
    };
  }

  // Generic error
  return {
    success: false,
    message: error.message || "File upload failed",
    code: "UPLOAD_ERROR",
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default upload;

// Export constants for use in controllers
export const UPLOAD_CONFIG = {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_IMAGE_COUNT: parseInt(process.env.MAX_IMAGE_COUNT) || 5,
  MAX_VIDEO_COUNT: parseInt(process.env.MAX_VIDEO_COUNT) || 2,
};

// Export validation functions
export { validateFileCount, validateFileSize, getFileCategory };