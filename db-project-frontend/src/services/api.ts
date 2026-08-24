// src/services/api.ts
import axios, { AxiosInstance } from "axios";
import { API_BASE_URL } from "../config/constants";

// ===================================================
// TYPE DEFINITIONS
// ===================================================

interface MediaUploadOptions {
  files: File[];
  captions?: string[];
  crimeId?: number | null;
  authToken?: string | null;
}

interface MediaUpdate {
  visibility?: 'public' | 'police_only';
  caption?: string;
  evidenceMarked?: boolean;
}

interface MediaValidationOptions {
  maxImages?: number;
  maxVideos?: number;
  maxFileSize?: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface FileWithCaption {
  file: File;
  caption: string;
  preview?: string;
  fileType?: 'image' | 'video';
}

interface UploadedMedia {
  id: number;
  publicId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileType: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  uploadedBy: 'citizen' | 'police';
  uploadedAt: string;
  visibility: 'public' | 'police_only';
  caption?: string;
  evidenceMarked: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// ===================================================
// AXIOS INSTANCE
// ===================================================

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper to attach token for future requests
export const setAuthToken = (token: string | null): void => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// ===================================================
// AUTH API
// ===================================================

export const loginUser = async (
  username: string,
  password: string,
  verify_role: string
): Promise<any> => {
  const res = await api.post("/auth/login", { username, password, verify_role });
  return res.data;
};

// ===================================================
// MEDIA API FUNCTIONS
// ===================================================

/**
 * Upload media files with optional captions
 */
export const uploadMedia = async ({
  files,
  captions = [],
  crimeId = null,
  authToken = null,
}: MediaUploadOptions): Promise<ApiResponse<{ media: UploadedMedia[]; crimeId: number | null; count: number }>> => {
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

  const res = await api.post("/media/upload", formData, { headers });
  return res.data;
};

/**
 * Get media for a specific crime (filtered by user role)
 */
export const getCrimeMedia = async (
  crimeId: number
): Promise<ApiResponse<{ crimeId: number; media: UploadedMedia[]; count: number; filtered: boolean }>> => {
  const res = await api.get(`/media/crime/${crimeId}`);
  return res.data;
};

/**
 * Update media metadata (visibility, caption, evidenceMarked)
 */
export const updateMedia = async (
  mediaId: number,
  updates: MediaUpdate
): Promise<ApiResponse<{ updated_media: UploadedMedia }>> => {
  const res = await api.put(`/media/${mediaId}`, updates);
  return res.data;
};

/**
 * Delete media item
 */
export const deleteMedia = async (
  mediaId: number
): Promise<ApiResponse<{ deletedMediaId: number; crimeId: number }>> => {
  const res = await api.delete(`/media/${mediaId}`);
  return res.data;
};

/**
 * Add media to existing crime report
 */
export const addMediaToCrime = async (
  crimeId: number,
  files: File[],
  captions: string[] = []
): Promise<ApiResponse<{ media: UploadedMedia[]; count: number }>> => {
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

  return res.data;
};

/**
 * Remove media from crime report
 */
export const removeMediaFromCrime = async (
  crimeId: number,
  mediaId: number
): Promise<ApiResponse<{ removedMediaId: number; crimeId: number }>> => {
  const res = await api.delete(`/crimes/${crimeId}/media/${mediaId}`);
  return res.data;
};

/**
 * Get thumbnail URL for media item (public endpoint)
 */
export const getMediaThumbnail = (mediaId: number): string => {
  return `${API_BASE_URL}/media/${mediaId}/thumbnail`;
};

// ===================================================
// HELPER FUNCTIONS
// ===================================================

/**
 * Build FormData for media upload
 */
export const buildMediaFormData = (
  filesWithCaptions: FileWithCaption[],
  crimeId?: number
): FormData => {
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
 */
export const validateMediaFiles = (
  files: File[],
  { maxImages = 5, maxVideos = 2, maxFileSize = 5242880 }: MediaValidationOptions = {}
): ValidationResult => {
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
 */
export const getFileCategory = (file: File): 'image' | 'video' | 'unknown' => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "unknown";
};

/**
 * Create preview URL for file
 */
export const createFilePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default api;
