// src/services/api.js
import axios from "axios";
import { API_BASE_URL } from "../config/constants"; // make sure this exists

// Example: API_BASE_URL = `${API_BASE_URL}`
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// helper to attach token for future requests
export const setAuthToken = (token) => {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
};

export const loginUser = async (username, password, verify_role) => {
  const res = await api.post("/auth/login", { username, password, verify_role });
  return res.data; // { success, token, user, ... }
};

// ===================================================
// 📱 MEDIA API FUNCTIONS
// ===================================================

/**
 * Upload media files with optional captions
 * @param {File[]} files - Array of files to upload
 * @param {string[]} captions - Array of captions (same length as files)
 * @param {number} [crimeId] - Optional crime ID for existing crimes
 * @param {string} [authToken] - Optional authorization token (for citizen auth)
 * @returns {Promise<Object>} Response with created media array
 */
export const uploadMedia = async (files, captions = [], crimeId = null, authToken = null) => {
  const formData = new FormData();

  // Append files
  files.forEach((file) => {
    formData.append("files", file);
  });

  // Append captions (must be same length as files)
  if (captions.length > 0) {
    captions.forEach((caption) => {
      formData.append("captions", caption || "");
    });
  }

  // Append crimeId if provided
  if (crimeId) {
    formData.append("crimeId", crimeId.toString());
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "multipart/form-data",
  };

  // Add auth token if provided (for citizen Supabase auth)
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await api.post("/media/upload", formData, {
    headers,
  });

  return res.data; // { success, data: { media, crimeId, count } }
};

/**
 * Get media for a specific crime (filtered by user role)
 * @param {number} crimeId - Crime ID
 * @returns {Promise<Object>} Response with media array
 */
export const getCrimeMedia = async (crimeId) => {
  const res = await api.get(`/media/crime/${crimeId}`);
  return res.data; // { success, data: { crimeId, media, count, filtered } }
};

/**
 * Update media metadata (visibility, caption, evidenceMarked)
 * @param {number} mediaId - Media ID to update
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.visibility] - 'public' or 'police_only'
 * @param {string} [updates.caption] - New caption
 * @param {boolean} [updates.evidenceMarked] - Evidence flag
 * @returns {Promise<Object>} Response with updated media
 */
export const updateMedia = async (mediaId, updates) => {
  const res = await api.put(`/media/${mediaId}`, updates);
  return res.data; // { success, data: { updated_media } }
};

/**
 * Delete media item
 * @param {number} mediaId - Media ID to delete
 * @returns {Promise<Object>} Response confirming deletion
 */
export const deleteMedia = async (mediaId) => {
  const res = await api.delete(`/media/${mediaId}`);
  return res.data; // { success, data: { deletedMediaId, crimeId } }
};

/**
 * Add media to existing crime report
 * @param {number} crimeId - Crime ID
 * @param {File[]} files - Array of files to add
 * @param {string[]} captions - Array of captions
 * @returns {Promise<Object>} Response with created media
 */
export const addMediaToCrime = async (crimeId, files, captions = []) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  if (captions.length > 0) {
    captions.forEach((caption) => {
      formData.append("captions", caption || "");
    });
  }

  const res = await api.post(`/crimes/${crimeId}/media`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data; // { success, data: { media, count } }
};

/**
 * Remove media from crime report
 * @param {number} crimeId - Crime ID
 * @param {number} mediaId - Media ID to remove
 * @returns {Promise<Object>} Response confirming removal
 */
export const removeMediaFromCrime = async (crimeId, mediaId) => {
  const res = await api.delete(`/crimes/${crimeId}/media/${mediaId}`);
  return res.data; // { success, data: { removedMediaId, crimeId } }
};

/**
 * Get thumbnail URL for media item (public endpoint)
 * @param {number} mediaId - Media ID
 * @returns {string} Thumbnail URL or placeholder
 */
export const getMediaThumbnail = (mediaId) => {
  return `${API_BASE_URL}/media/${mediaId}/thumbnail`;
};

// ===================================================
// 📋 HELPER FUNCTIONS
// ===================================================

/**
 * Build FormData for media upload
 * @param {FileWithCaption[]} filesWithCaptions - Array of {file, caption} objects
 * @param {number} [crimeId] - Optional crime ID
 * @returns {FormData} FormData object ready for upload
 */
export const buildMediaFormData = (filesWithCaptions, crimeId = null) => {
  const formData = new FormData();

  filesWithCaptions.forEach(({ file, caption }) => {
    formData.append("files", file);
    formData.append("captions", caption || "");
  });

  if (crimeId) {
    formData.append("crimeId", crimeId.toString());
  }

  return formData;
};

/**
 * Validate media files before upload
 * @param {File[]} files - Files to validate
 * @param {Object} limits - Upload limits
 * @param {number} [limits.maxImages=5] - Max image count
 * @param {number} [limits.maxVideos=2] - Max video count
 * @param {number} [limits.maxFileSize=5242880] - Max file size (5MB)
 * @returns {Object} Validation result
 */
export const validateMediaFiles = (
  files,
  { maxImages = 5, maxVideos = 2, maxFileSize = 5242880 } = {}
) => {
  const images = files.filter((file) => file.type.startsWith("image/"));
  const videos = files.filter((file) => file.type.startsWith("video/"));

  // Check file counts
  if (images.length > maxImages) {
    return {
      valid: false,
      error: `Maximum ${maxImages} images allowed. You have ${images.length}.`,
    };
  }

  if (videos.length > maxVideos) {
    return {
      valid: false,
      error: `Maximum ${maxVideos} videos allowed. You have ${videos.length}.`,
    };
  }

  // Check file sizes
  for (const file of files) {
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds maximum size of ${maxFileSize / 1024 / 1024}MB.`,
      };
    }
  }

  // Check file types
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];

  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type "${file.type}" not supported. Allowed: ${allowedTypes.join(", ")}`,
      };
    }
  }

  return { valid: true };
};

/**
 * Categorize file as image or video
 * @param {File} file - File to categorize
 * @returns {string} 'image', 'video', or 'unknown'
 */
export const getFileCategory = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "unknown";
};

/**
 * Create preview URL for file
 * @param {File} file - File to create preview for
 * @returns {Promise<string>} Preview URL
 */
export const createFilePreview = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// add other API helpers as needed, example:
// export const fetchCrimes = () => api.get("/crimes");

export default api;
