import { cleanupOrphanedMedia, getOrphanedMediaStats } from "../utils/mediaCleanup.js";
import db from "../models/index.js";

/**
 * Admin controller for cleanup operations
 * Handles orphaned media cleanup and system maintenance
 */

/**
 * Get statistics about orphaned media files
 * GET /api/admin/cleanup/stats
 */
export const getCleanupStats = async (req, res) => {
  try {
    const stats = await getOrphanedMediaStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting cleanup stats:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cleanup statistics",
      error: error.message,
    });
  }
};

/**
 * Clean up orphaned media files
 * POST /api/admin/cleanup/media
 *
 * @param {number} req.body.hoursOld - Only clean media older than this (default: 24)
 */
export const cleanupOrphanedMediaFiles = async (req, res) => {
  try {
    const { hoursOld = 24 } = req.body;

    if (!req.user?.role || (req.user.role !== 'admin' && req.user.role !== 'police')) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. Admin or police access required.",
      });
    }

    const result = await cleanupOrphanedMedia(hoursOld);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error cleaning up orphaned media:", error);
    res.status(500).json({
      success: false,
      message: "Error cleaning up orphaned media",
      error: error.message,
    });
  }
};

/**
 * Get system cleanup overview
 * GET /api/admin/cleanup/overview
 */
export const getCleanupOverview = async (req, res) => {
  try {
    const [mediaStats, totalMedia] = await Promise.all([
      getOrphanedMediaStats(),
      db.CrimeMedia.count(),
    ]);

    const orphanCount = mediaStats.success ? mediaStats.data.total_orphans : 0;

    res.status(200).json({
      success: true,
      data: {
        totalMedia,
        orphanedMedia: orphanCount,
        orphanedPercentage: totalMedia > 0 ? ((orphanCount / totalMedia) * 100).toFixed(2) : 0,
        oldestOrphan: mediaStats.success ? mediaStats.data.oldest_upload : null,
        stats: mediaStats.success ? mediaStats.data : null,
      },
    });
  } catch (error) {
    console.error("Error getting cleanup overview:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cleanup overview",
      error: error.message,
    });
  }
};

export default {
  getCleanupStats,
  cleanupOrphanedMediaFiles,
  getCleanupOverview,
};
