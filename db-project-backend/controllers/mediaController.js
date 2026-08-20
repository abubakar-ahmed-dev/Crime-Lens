import db from "../models/index.js";
import {
  uploadFile,
  getThumbnail,
  deleteFile,
  handleCloudinaryError,
} from "../config/cloudinaryConfig.js";
import {
  validateFileCount,
  validateFileSize,
  getFileCategory,
  handleMulterError,
} from "../config/multerMediaConfig.js";

const { CrimeMedia, Crime } = db;

// ============================================================================
// MEDIA CONTROLLER
// ============================================================================
// Purpose: Handle all media-related operations for crime reports
//
// Features:
// - Upload media with captions (citizens and police)
// - Retrieve media with visibility filtering
// - Update media metadata (visibility, caption, evidence flag)
// - Delete media and update Crime.latestUpdatedBy
// - Add/remove media from existing crimes
// - File count validation (5 images, 2 videos)
// ============================================================================

/**
 * Upload media files to Cloudinary and create CrimeMedia records
 * POST /api/media/upload
 *
 * @param {Array} req.files - Array of uploaded files from Multer
 * @param {Array} req.body.captions - Array of captions (optional, same length as files)
 * @param {number} req.body.crimeId - Optional crime ID for existing crimes
 * @param {Object} req.user - Authenticated user info
 */
export const uploadMedia = async (req, res) => {
  let t;

  try {
    const { files } = req;
    const { captions = [], crimeId: existingCrimeId } = req.body;
    const userId = req.user?.id;
    const uploadedBy = req.user?.role ? "police" : "citizen";

    // Validate files exist
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
        code: "NO_FILES",
      });
    }

    // Validate file count
    const countValidation = validateFileCount(files);
    if (!countValidation.valid) {
      return res.status(400).json({
        success: false,
        message: countValidation.message,
        code: "FILE_COUNT_EXCEEDED",
      });
    }

    // Validate captions array length matches files
    if (captions.length > 0 && captions.length !== files.length) {
      return res.status(400).json({
        success: false,
        message: "Captions array length must match files array length",
        code: "CAPTION_MISMATCH",
      });
    }

    // Start database transaction
    t = await db.sequelize.transaction();

    let targetCrimeId = existingCrimeId;
    let isNewCrime = false;

    // If uploading to existing crime, verify it exists
    if (existingCrimeId) {
      const crime = await Crime.findByPk(existingCrimeId, { transaction: t });
      if (!crime) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Crime not found",
          code: "CRIME_NOT_FOUND",
        });
      }
      targetCrimeId = existingCrimeId;
    }

    // Upload files to Cloudinary
    const uploadPromises = files.map((file, index) => {
      const caption = captions[index] || null;
      return uploadFile(file.buffer, file.originalname, targetCrimeId || "temp").then(
        (uploadResult) => ({
          ...uploadResult,
          caption,
          uploadedBy,
          CrimeId: targetCrimeId || null,
        })
      );
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Generate thumbnails
    const mediaRecords = uploadResults.map((upload) => {
      const thumbnailUrl = getThumbnail(upload.publicId, upload.fileType);
      return {
        CrimeId: upload.CrimeId,
        publicId: upload.publicId,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        fileType: upload.fileType,
        url: upload.url,
        thumbnailUrl: thumbnailUrl,
        width: upload.width,
        height: upload.height,
        duration: upload.duration,
        uploadedBy: upload.uploadedBy,
        visibility: "public", // Default to public
        caption: upload.caption,
        evidenceMarked: false,
      };
    });

    // Create CrimeMedia records
    const createdMedia = await CrimeMedia.bulkCreate(mediaRecords, {
      transaction: t,
      returning: true,
    });

    // Update Crime record if crimeId exists
    if (targetCrimeId) {
      const imageCount = createdMedia.filter((m) => m.fileType === "image").length;
      const videoCount = createdMedia.filter((m) => m.fileType === "video").length;

      await Crime.update(
        {
          mediaCount: db.sequelize.literal(`"mediaCount" + ${createdMedia.length}`),
          // Set thumbnailUrl if not already set and there's an image
          ...(imageCount > 0 && {
            thumbnailUrl: createdMedia.find((m) => m.fileType === "image")?.thumbnailUrl,
          }),
        },
        {
          where: { id: targetCrimeId },
          transaction: t,
        }
      );
    }

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Media uploaded successfully",
      data: {
        media: createdMedia,
        crimeId: targetCrimeId,
        count: createdMedia.length,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Upload media error:", error);

    const cloudinaryError = handleCloudinaryError(error);
    if (cloudinaryError.code !== "CLOUDINARY_ERROR") {
      return res.status(400).json(cloudinaryError);
    }

    res.status(500).json({
      success: false,
      message: "Error uploading media",
      error: error.message,
    });
  }
};

/**
 * Get media for a crime, filtered by visibility based on user role
 * GET /api/media/crime/:crimeId
 *
 * @param {number} req.params.crimeId - Crime ID
 * @param {Object} req.user - Authenticated user (optional for public)
 */
export const getCrimeMedia = async (req, res) => {
  try {
    const { crimeId } = req.params;
    const userRole = req.user?.role; // 'admin', 'police', or undefined for citizens

    // Verify crime exists
    const crime = await Crime.findByPk(crimeId);
    if (!crime) {
      return res.status(404).json({
        success: false,
        message: "Crime not found",
        code: "CRIME_NOT_FOUND",
      });
    }

    // Build where clause based on user role
    const whereClause = { CrimeId: crimeId };

    // Citizens only see public media, police/admin see all
    if (userRole !== "admin" && userRole !== "police") {
      whereClause.visibility = "public";
    }

    const media = await CrimeMedia.findAll({
      where: whereClause,
      order: [["uploadedAt", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: {
        crimeId,
        media,
        count: media.length,
        totalMediaCount: crime.mediaCount || 0,
        userRole: userRole || "citizen",
        filtered: userRole !== "admin" && userRole !== "police",
      },
    });
  } catch (error) {
    console.error("Get crime media error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving media",
      error: error.message,
    });
  }
};

/**
 * Update media metadata (visibility, caption, evidence flag)
 * PUT /api/media/:id
 *
 * @param {number} req.params.id - Media ID
 * @param {string} req.body.visibility - Optional: 'public' or 'police_only'
 * @param {string} req.body.caption - Optional: New caption
 * @param {boolean} req.body.evidenceMarked - Optional: Evidence flag
 * @param {Object} req.user - Authenticated police user
 */
export const updateMedia = async (req, res) => {
  let t;

  try {
    const { id } = req.params;
    const { visibility, caption, evidenceMarked } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Find media record
    const media = await CrimeMedia.findByPk(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
        code: "MEDIA_NOT_FOUND",
      });
    }

    // Build update object with only provided fields
    const updates = {};
    if (visibility !== undefined) {
      if (!["public", "police_only"].includes(visibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid visibility value. Must be 'public' or 'police_only'",
          code: "INVALID_VISIBILITY",
        });
      }
      updates.visibility = visibility;
    }
    if (caption !== undefined) updates.caption = caption;
    if (evidenceMarked !== undefined) updates.evidenceMarked = evidenceMarked;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
        code: "NO_UPDATES",
      });
    }

    // Start transaction
    t = await db.sequelize.transaction();

    // Update media record
    await media.update(updates, { transaction: t });

    // Update Crime.latestUpdatedBy
    await Crime.update(
      { latestUpdatedBy: userId },
      { where: { id: media.CrimeId }, transaction: t }
    );

    await t.commit();

    // Fetch updated media
    const updatedMedia = await CrimeMedia.findByPk(id);

    res.status(200).json({
      success: true,
      message: "Media updated successfully",
      data: updatedMedia,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Update media error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating media",
      error: error.message,
    });
  }
};

/**
 * Delete media file and update Crime metadata
 * DELETE /api/media/:id
 *
 * @param {number} req.params.id - Media ID
 * @param {Object} req.user - Authenticated police user
 */
export const deleteMedia = async (req, res) => {
  let t;

  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Find media record
    const media = await CrimeMedia.findByPk(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
        code: "MEDIA_NOT_FOUND",
      });
    }

    const crimeId = media.CrimeId;
    const publicId = media.publicId;
    const fileType = media.fileType;

    // Start transaction
    t = await db.sequelize.transaction();

    // Delete from database
    await media.destroy({ transaction: t });

    // Update Crime.latestUpdatedBy
    await Crime.update(
      { latestUpdatedBy: userId },
      { where: { id: crimeId }, transaction: t }
    );

    await t.commit();

    // Delete from Cloudinary (fire and forget, non-critical)
    deleteFile(publicId, fileType).catch((err) => {
      console.error("Cloudinary delete error (non-critical):", err);
    });

    res.status(200).json({
      success: true,
      message: "Media deleted successfully",
      data: {
        deletedMediaId: id,
        crimeId,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Delete media error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting media",
      error: error.message,
    });
  }
};

/**
 * Add media to an existing crime report
 * POST /api/crimes/:crimeId/media
 *
 * @param {number} req.params.crimeId - Crime ID
 * @param {Array} req.files - Files to upload
 * @param {Array} req.body.captions - Optional captions
 * @param {Object} req.user - Authenticated user
 */
export const addMediaToCrime = async (req, res) => {
  let t;

  try {
    const { crimeId } = req.params;
    const { files } = req;
    const { captions = [] } = req.body;
    const userId = req.user?.id;
    const uploadedBy = req.user?.role ? "police" : "citizen";

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
        code: "NO_FILES",
      });
    }

    // Verify crime exists
    const crime = await Crime.findByPk(crimeId);
    if (!crime) {
      return res.status(404).json({
        success: false,
        message: "Crime not found",
        code: "CRIME_NOT_FOUND",
      });
    }

    // Check current media count
    const currentCount = crime.mediaCount || 0;
    const currentImages = await CrimeMedia.count({
      where: { CrimeId: crimeId, fileType: "image" },
    });
    const currentVideos = await CrimeMedia.count({
      where: { CrimeId: crimeId, fileType: "video" },
    });

    // Validate new files won't exceed limits
    const newImages = files.filter((f) => f.mimetype.startsWith("image/")).length;
    const newVideos = files.filter((f) => f.mimetype.startsWith("video/")).length;

    const MAX_IMAGES = 5;
    const MAX_VIDEOS = 2;

    if (currentImages + newImages > MAX_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${newImages} images. Would exceed limit of ${MAX_IMAGES} images`,
        code: "IMAGE_LIMIT_EXCEEDED",
      });
    }

    if (currentVideos + newVideos > MAX_VIDEOS) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${newVideos} videos. Would exceed limit of ${MAX_VIDEOS} videos`,
        code: "VIDEO_LIMIT_EXCEEDED",
      });
    }

    // Start transaction
    t = await db.sequelize.transaction();

    // Upload files to Cloudinary
    const uploadPromises = files.map((file, index) => {
      const caption = captions[index] || null;
      return uploadFile(file.buffer, file.originalname, crimeId).then((uploadResult) => ({
        ...uploadResult,
        caption,
        uploadedBy,
      }));
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Generate thumbnails and create media records
    const mediaRecords = uploadResults.map((upload) => {
      const thumbnailUrl = getThumbnail(upload.publicId, upload.fileType);
      return {
        CrimeId: crimeId,
        publicId: upload.publicId,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        fileType: upload.fileType,
        url: upload.url,
        thumbnailUrl: thumbnailUrl,
        width: upload.width,
        height: upload.height,
        duration: upload.duration,
        uploadedBy: upload.uploadedBy,
        visibility: "public",
        caption: upload.caption,
        evidenceMarked: false,
      };
    });

    const createdMedia = await CrimeMedia.bulkCreate(mediaRecords, {
      transaction: t,
      returning: true,
    });

    // Update Crime record
    const imageCount = createdMedia.filter((m) => m.fileType === "image").length;
    await Crime.update(
      {
        mediaCount: db.sequelize.literal(`"mediaCount" + ${createdMedia.length}`),
        ...(imageCount > 0 && {
          thumbnailUrl: createdMedia.find((m) => m.fileType === "image")?.thumbnailUrl,
        }),
      },
      { where: { id: crimeId }, transaction: t }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Media added to crime successfully",
      data: {
        media: createdMedia,
        crimeId,
        count: createdMedia.length,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Add media to crime error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding media to crime",
      error: error.message,
    });
  }
};

/**
 * Remove media from a crime report
 * DELETE /api/crimes/:crimeId/media/:mediaId
 *
 * @param {number} req.params.crimeId - Crime ID
 * @param {number} req.params.mediaId - Media ID
 * @param {Object} req.user - Authenticated police user
 */
export const removeMediaFromCrime = async (req, res) => {
  let t;

  try {
    const { crimeId, mediaId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    // Verify media belongs to the specified crime
    const media = await CrimeMedia.findOne({
      where: { id: mediaId, CrimeId: crimeId },
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found or does not belong to this crime",
        code: "MEDIA_NOT_FOUND",
      });
    }

    const publicId = media.publicId;
    const fileType = media.fileType;

    // Start transaction
    t = await db.sequelize.transaction();

    // Delete from database
    await media.destroy({ transaction: t });

    // Update Crime.latestUpdatedBy
    await Crime.update(
      { latestUpdatedBy: userId },
      { where: { id: crimeId }, transaction: t }
    );

    await t.commit();

    // Delete from Cloudinary (fire and forget)
    deleteFile(publicId, fileType).catch((err) => {
      console.error("Cloudinary delete error (non-critical):", err);
    });

    res.status(200).json({
      success: true,
      message: "Media removed from crime successfully",
      data: {
        deletedMediaId: mediaId,
        crimeId,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Remove media from crime error:", error);
    res.status(500).json({
      success: false,
      message: "Error removing media from crime",
      error: error.message,
    });
  }
};

/**
 * Get thumbnail for a media item
 * GET /api/media/:id/thumbnail
 *
 * @param {number} req.params.id - Media ID
 */
export const getMediaThumbnail = async (req, res) => {
  try {
    const { id } = req.params;

    const media = await CrimeMedia.findByPk(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
        code: "MEDIA_NOT_FOUND",
      });
    }

    // Redirect to thumbnail URL
    if (media.thumbnailUrl) {
      return res.redirect(media.thumbnailUrl);
    }

    // Generate thumbnail if not stored
    const thumbnailUrl = getThumbnail(media.publicId, media.fileType);
    res.redirect(thumbnailUrl);
  } catch (error) {
    console.error("Get thumbnail error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving thumbnail",
      error: error.message,
    });
  }
};