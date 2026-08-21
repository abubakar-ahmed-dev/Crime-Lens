// MapViewPage/components/types.ts

/**
 * CrimeMedia Interface
 * Represents media items (images/videos) attached to crime reports
 */
export interface CrimeMedia {
  id: number;
  CrimeId: number;
  publicId: string;           // Cloudinary public ID
  originalName: string;       // Original filename
  mimeType: string;           // MIME type (image/jpeg, video/mp4, etc.)
  fileSize: number;           // File size in bytes
  fileType: 'image' | 'video'; // Media type category
  url: string;                // Full URL to media file
  thumbnailUrl: string;       // URL to thumbnail (200x200)
  width?: number;             // Image width (pixels)
  height?: number;            // Image height (pixels)
  duration?: number;          // Video duration (seconds)
  uploadedBy: 'citizen' | 'police'; // Who uploaded
  uploadedAt: string;         // ISO timestamp
  visibility: 'public' | 'police_only'; // Access control
  caption?: string;           // Optional description
  evidenceMarked: boolean;    // Police evidence flag
}

/**
 * Crime Interface (Extended)
 * Represents a crime report with media support
 */
export interface Crime {
  id: number;
  crimeTypeId: number;
  crimeTypeName: string;      // from backend
  status: string;
  incidentDate: string;       // from backend
  latitude: number;           // from backend
  longitude: number;          // from backend

  // Optional fields from backend
  title?: string;
  description?: string;
  zoneName?: string;
  address?: string;
  zoneId?: number;
  thumbnailUrl?: string;      // Primary thumbnail for map view
  mediaCount?: number;        // Total media items count
  media?: CrimeMedia[];       // Array of media items (police/admin only)
}

/**
 * Media Upload Types
 */
export type MediaFileType = 'image' | 'video';

export interface MediaUploadFile {
  file: File;
  caption: string;
  preview?: string;          // Data URL for preview
}

/**
 * Media Update Types (for police editing)
 */
export interface MediaUpdate {
  mediaId: number;
  visibility?: 'public' | 'police_only';
  caption?: string;
  evidenceMarked?: boolean;
}

export interface MediaOperations {
  toUpdate?: MediaUpdate[];
  toRemove?: number[];
}

/**
 * API Response Types
 */
export interface MediaUploadResponse {
  success: boolean;
  data?: {
    media: CrimeMedia[];
    crimeId: number;
    count: number;
  };
  message?: string;
}

export interface CrimeMediaResponse {
  success: boolean;
  data?: {
    crimeId: number;
    media: CrimeMedia[];
    count: number;
    totalMediaCount?: number;
    userRole?: string;
    filtered?: boolean;
  };
  message?: string;
}

/**
 * Zone Type (unchanged)
 */
export type Zone = {
  zoneId: number;
  zoneName: string;
  severity: number;
  color: string;
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};
