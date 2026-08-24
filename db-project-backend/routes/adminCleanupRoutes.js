import express from "express";
import {
  getCleanupStats,
  cleanupOrphanedMediaFiles,
  getCleanupOverview,
} from "../controllers/adminCleanupController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// All cleanup endpoints require authentication
router.use(verifyToken);

/**
 * GET /api/admin/cleanup/stats
 * Get statistics about orphaned media files
 */
router.get("/stats", getCleanupStats);

/**
 * POST /api/admin/cleanup/media
 * Clean up orphaned media files
 * Body: { hoursOld: number }
 */
router.post("/media", cleanupOrphanedMediaFiles);

/**
 * GET /api/admin/cleanup/overview
 * Get system cleanup overview
 */
router.get("/overview", getCleanupOverview);

export default router;
