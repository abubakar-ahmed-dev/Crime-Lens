import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// Cloudinary Configuration
// ============================================================================
// Purpose: Configure Cloudinary SDK for media upload, transformation,
// and management for crime report evidence files
//
// Features:
// - Image and video upload with automatic optimization
// - Thumbnail generation (200x200 for images, first frame for videos)
// - File deletion with proper error handling
// - Organized folder structure (crimes/{crimeId})
// - Resource type auto-detection
// ============================================================================

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use HTTPS
});

// ============================================================================
// UPLOAD CONFIGURATION
// ============================================================================

const UPLOAD_OPTIONS = {
  // Folder organization
  folder: "crimes", // Will be extended with crimeId: crimes/{crimeId}
  resource_type: "auto", // Auto-detect image/video
  allowed_formats: ["jpg", "png", "gif", "webp", "mp4", "mov", "webm"],

  // Image transformations
  quality: "auto", // Automatic quality optimization
  fetch_format: "auto", // Automatic format optimization

  // Video transformations
  video_codec: "auto",
  audio_codec: "auto",

  // Upload limits
  max_file_size: 5000000, // 5MB
  chunk_size: 6000000, // For large files

  // Other options
  overwrite: false, // Don't overwrite existing files
  unique_filename: true, // Add random suffix to prevent duplicates
  use_filename: true, // Use original filename as base
};

// ============================================================================
// THUMBNAIL GENERATION CONFIGURATION
// ============================================================================

const THUMBNAIL_OPTIONS = {
  // Image thumbnails
  image: {
    transformation: [
      { width: 200, height: 200, crop: "fill", gravity: "auto" },
      { quality: "auto", fetch_format: "auto" },
    ],
  },

  // Video thumbnails (first frame)
  video: {
    resource_type: "video",
    transformation: [
      { width: 200, height: 200, crop: "fill" },
      { quality: "auto", fetch_format: "auto" },
    ],
  },
};

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload a single file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from Multer
 * @param {string} originalName - Original filename
 * @param {string} crimeId - Crime ID for folder organization
 * @returns {Promise<Object>} Upload result with URL, publicId, and metadata
 */
export const uploadFile = async (fileBuffer, originalName, crimeId) => {
  try {
    const options = {
      ...UPLOAD_OPTIONS,
      folder: `crimes/${crimeId}`, // Organize by crime ID
      public_id: `${Date.now()}_${originalName.split(".")[0]}`, // Unique ID
    };

    const result = await cloudinary.uploader.upload(fileBuffer, options);

    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      originalName: originalName,
      mimeType: result.resource_type === "image" ? `image/${result.format}` : `video/${result.format}`,
      fileSize: result.bytes,
      fileType: result.resource_type, // 'image' or 'video'
      width: result.width,
      height: result.height,
      duration: result.duration || null, // Video duration in seconds
      format: result.format,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array} files - Array of file objects with buffer and originalname
 * @param {string} crimeId - Crime ID for folder organization
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleFiles = async (files, crimeId) => {
  const uploadPromises = files.map((file) =>
    uploadFile(file.buffer, file.originalname, crimeId)
  );

  try {
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error("Batch upload error:", error);
    throw new Error(`Batch upload failed: ${error.message}`);
  }
};

// ============================================================================
// THUMBNAIL GENERATION
// ============================================================================

/**
 * Generate thumbnail URL for an image
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} Thumbnail URL
 */
export const getImageThumbnail = (publicId) => {
  return cloudinary.url(publicId, THUMBNAIL_OPTIONS.image);
};

/**
 * Generate thumbnail URL for a video (first frame)
 * @param {string} publicId - Cloudinary public ID
 * @returns {string} Thumbnail URL
 */
export const getVideoThumbnail = (publicId) => {
  return cloudinary.url(publicId, THUMBNAIL_OPTIONS.video);
};

/**
 * Generate appropriate thumbnail based on file type
 * @param {string} publicId - Cloudinary public ID
 * @param {string} fileType - 'image' or 'video'
 * @returns {string} Thumbnail URL
 */
export const getThumbnail = (publicId, fileType) => {
  if (fileType === "video") {
    return getVideoThumbnail(publicId);
  }
  return getImageThumbnail(publicId);
};

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

/**
 * Delete a single file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFile = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result === "ok" || result.result === "not found") {
      return {
        success: true,
        message: result.result === "ok" ? "File deleted successfully" : "File not found (already deleted)",
      };
    }

    throw new Error(`Delete failed: ${result.result}`);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param {Array} publicIds - Array of Cloudinary public IDs
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<Object>} Batch deletion result
 */
export const deleteMultipleFiles = async (publicIds, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicIds, {
      resource_type: resourceType,
    });

    return {
      success: true,
      deleted: result.deleted || [],
      failed: result.failed || [],
      message: `Deleted ${result.deleted?.length || 0} files`,
    };
  } catch (error) {
    console.error("Batch delete error:", error);
    throw new Error(`Batch delete failed: ${error.message}`);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get file info from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<Object>} File metadata
 */
export const getFileInfo = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });

    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      format: result.format,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error("Get file info error:", error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
};

/**
 * Check if file exists in Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - 'image' or 'video'
 * @returns {Promise<boolean>} True if file exists
 */
export const fileExists = async (publicId, resourceType = "image") => {
  try {
    await getFileInfo(publicId, resourceType);
    return true;
  } catch (error) {
    if (error.message?.includes("Not Found") || error.http_code === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * Extract video duration from Cloudinary response
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<number>} Duration in seconds
 */
export const getVideoDuration = async (publicId) => {
  try {
    const info = await getFileInfo(publicId, "video");
    return info.duration || 0;
  } catch (error) {
    console.error("Get video duration error:", error);
    return 0;
  }
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle Cloudinary API errors
 * @param {Error} error - Cloudinary error
 * @returns {Object} Formatted error response
 */
export const handleCloudinaryError = (error) => {
  // Common Cloudinary error codes
  const errorMap = {
    "Upload request exceeds the allowed limit": {
      code: "FILE_TOO_LARGE",
      message: "File size exceeds maximum allowed limit",
    },
    "Invalid image file": {
      code: "INVALID_FILE",
      message: "Uploaded file is not a valid image or video",
    },
    "Resource not found": {
      code: "NOT_FOUND",
      message: "File not found in Cloudinary",
    },
    "Authentication required": {
      code: "AUTH_ERROR",
      message: "Cloudinary authentication failed",
    },
    "Rate limit exceeded": {
      code: "RATE_LIMIT",
      message: "Cloudinary rate limit exceeded, please try again later",
    },
  };

  const errorMessage = error.message || "Unknown Cloudinary error";
  const mappedError = errorMap[errorMessage];

  if (mappedError) {
    return {
      success: false,
      code: mappedError.code,
      message: mappedError.message,
    };
  }

  // Generic error
  return {
    success: false,
    code: "CLOUDINARY_ERROR",
    message: `Cloudinary operation failed: ${errorMessage}`,
  };
};

// ============================================================================
// CONFIGURATION EXPORTS
// ============================================================================

export const CLOUDINARY_CONFIG = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
  maxFileSize: UPLOAD_OPTIONS.max_file_size,
  allowedFormats: UPLOAD_OPTIONS.allowed_formats,
  thumbnailOptions: THUMBNAIL_OPTIONS,
};

export default cloudinary;