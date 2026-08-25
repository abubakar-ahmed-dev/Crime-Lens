import express from "express";
import upload from "../config/multerMediaConfig.js";
import {
  uploadMedia,
  getCrimeMedia,
  updateMedia,
  deleteMedia,
  addMediaToCrime,
  removeMediaFromCrime,
  getMediaThumbnail,
} from "../controllers/mediaController.js";
import { verifyToken, authorizeRoles, authorizeCitizen } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================================================================
// MEDIA ROUTES
// ============================================================================
// Purpose: Define API endpoints for media upload, retrieval, and management
//
// Authentication Levels:
// - Public: No authentication required
// - Citizen: Supabase JWT required (authorizeCitizen)
// - Police/Admin: Backend JWT required (verifyToken + authorizeRoles)
// ============================================================================

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * Get thumbnail for a media item
 * GET /api/media/:id/thumbnail
 *
 * Public endpoint - redirects to Cloudinary thumbnail URL
 * Used by map views and public displays
 */
router.get("/:id/thumbnail", getMediaThumbnail);

// ============================================================================
// CITIZEN ROUTES (Supabase Authentication Required)
// ============================================================================

/**
 * Upload media files with optional captions
 * POST /api/media/upload
 *
 * Citizens can upload images and videos with optional captions
 * Files default to visibility='public'
 * Content-Type: multipart/form-data
 *
 * Request body:
 * - files: Array of files (max 5 images + 2 videos)
 * - captions: Array of caption strings (optional, same length as files)
 * - crimeId: Optional crime ID for existing crimes
 */
router.post(
  "/upload",
  upload.array("files", 10), // Max 10 files (5 images + 2 videos + buffer)
  authorizeCitizen,
  uploadMedia
);

/**
 * Get media for a specific crime
 * GET /api/media/crime/:crimeId
 *
 * Returns media filtered by visibility:
 * - Citizens/public: Only visibility='public' media
 * - Police/admin: All media regardless of visibility
 */
router.get("/crime/:crimeId", authorizeCitizen, getCrimeMedia);

// ============================================================================
// POLICE/ADMIN ROUTES (Backend JWT + Role Authorization Required)
// ============================================================================

/**
 * Update media metadata
 * PUT /api/media/:id
 *
 * Police can update:
 * - visibility: Toggle between 'public' and 'police_only'
 * - caption: Edit description
 * - evidenceMarked: Mark as official evidence
 *
 * Automatically updates Crime.latestUpdatedBy with police user ID
 */
router.put(
  "/:id",
  verifyToken,
  authorizeRoles("police", "admin"),
  updateMedia
);

/**
 * Delete a media item
 * DELETE /api/media/:id
 *
 * Permanently deletes media from database and Cloudinary
 * Automatically updates Crime.latestUpdatedBy with police user ID
 */
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("police", "admin"),
  deleteMedia
);

/**
 * Add media to an existing crime report
 * POST /api/crimes/:crimeId/media
 *
 * Police can add additional evidence to existing crimes
 * Validates file count limits before adding
 * Automatically updates Crime.latestUpdatedBy with police user ID
 *
 * Request body:
 * - files: Array of files to add
 * - captions: Array of caption strings (optional)
 */
router.post(
  "/crimes/:crimeId/media",
  upload.array("files", 10),
  verifyToken,
  authorizeRoles("police", "admin"),
  addMediaToCrime
);

/**
 * Remove specific media from a crime report
 * DELETE /api/crimes/:crimeId/media/:mediaId
 *
 * Police can remove inappropriate or incorrect media
 * Verifies media belongs to specified crime before removal
 * Automatically updates Crime.latestUpdatedBy with police user ID
 */
router.delete(
  "/crimes/:crimeId/media/:mediaId",
  verifyToken,
  authorizeRoles("police", "admin"),
  removeMediaFromCrime
);

// ============================================================================
// EXPORT ROUTER
// ============================================================================

export default router;