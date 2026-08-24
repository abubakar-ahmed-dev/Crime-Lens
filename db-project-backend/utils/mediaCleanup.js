import db from "../models/index.js";
import { deleteFile } from "../config/cloudinaryConfig.js";

/**
 * Find orphaned media files (uploaded but not linked to any crime)
 * These occur when users upload media but abandon the crime submission form
 *
 * @param {number} hoursOld - Only consider media older than this many hours (default: 24)
 * @returns {Promise<Array>} Array of orphaned media records
 */
export const findOrphanedMedia = async (hoursOld = 24) => {
  const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

  // Find media that was uploaded but not associated with any crime
  // This happens when uploadMedia is called without a crimeId and the crime is never created
  const result = await db.sequelize.query(`
    SELECT cm.id, cm."publicId", cm."fileType", cm."uploadedAt"
    FROM "CrimeMedia" cm
    WHERE cm."CrimeId" IS NULL
      AND cm."uploadedAt" < :cutoffTime
    ORDER BY cm."uploadedAt" ASC
  `, {
    replacements: { cutoffTime },
    type: db.sequelize.QueryTypes.SELECT,
  });

  return result;
};

/**
 * Delete orphaned media from both database and Cloudinary
 *
 * @param {number} hoursOld - Only consider media older than this many hours
 * @returns {Promise<Object>} Cleanup results
 */
export const cleanupOrphanedMedia = async (hoursOld = 24) => {
  try {
    const orphans = await findOrphanedMedia(hoursOld);

    let deletedCount = 0;
    const errors = [];

    for (const orphan of orphans) {
      try {
        // Delete from Cloudinary
        await deleteFile(orphan.publicId, orphan.fileType);

        // Delete from database
        await db.CrimeMedia.destroy({ where: { id: orphan.id } });

        deletedCount++;
      } catch (error) {
        errors.push({
          mediaId: orphan.id,
          publicId: orphan.publicId,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      deletedCount,
      totalFound: orphans.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get statistics about potential orphaned media
 *
 * @returns {Promise<Object>} Statistics about orphaned media
 */
export const getOrphanedMediaStats = async () => {
  try {
    const stats = await db.sequelize.query(`
      SELECT
        COUNT(*) as total_orphans,
        COUNT(*) FILTER (WHERE "fileType" = 'image') as image_count,
        COUNT(*) FILTER (WHERE "fileType" = 'video') as video_count,
        MIN("uploadedAt") as oldest_upload,
        MAX("uploadedAt") as newest_upload
      FROM "CrimeMedia"
      WHERE "CrimeId" IS NULL
    `, {
      type: db.sequelize.QueryTypes.SELECT,
    });

    return {
      success: true,
      data: stats[0],
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  findOrphanedMedia,
  cleanupOrphanedMedia,
  getOrphanedMediaStats,
};
