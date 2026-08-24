import DataTypes from "sequelize";

/**
 * CrimeMedia Model
 *
 * Stores metadata for all uploaded media files (images and videos) associated with crime reports.
 * Media files are stored in Cloudinary, this table stores references and metadata.
 *
 * Fields:
 * - id: Unique identifier for each media record
 * - CrimeId: Foreign key reference to Crime table (cascade delete)
 * - publicId: Cloudinary public ID for the uploaded file
 * - originalName: Original filename from user's device
 * - mimeType: MIME type (e.g., 'image/jpeg', 'video/mp4')
 * - fileSize: Size of file in bytes
 * - fileType: 'image' or 'video'
 * - url: Full Cloudinary URL to access the file
 * - thumbnailUrl: URL to thumbnail version
 * - width: Image/video width in pixels
 * - height: Image/video height in pixels
 * - duration: Video duration in seconds (NULL for images)
 * - uploadedBy: 'citizen' or 'police'
 * - uploadedAt: Timestamp when file was uploaded
 * - visibility: 'public' or 'police_only' (defaults to 'public')
 * - caption: Optional description from citizen or police
 * - evidenceMarked: Whether police marked as official evidence
 */
export default (sequelize) => {
  const CrimeMedia = sequelize.define("CrimeMedia", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    CrimeId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "CrimeId",
    },
    publicId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fileType: {
      type: DataTypes.ENUM("image", "video"),
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Video duration in seconds (NULL for images)",
    },
    uploadedBy: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "'citizen' or 'police'",
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    visibility: {
      type: DataTypes.ENUM("public", "police_only"),
      allowNull: false,
      defaultValue: "public",
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    evidenceMarked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: "CrimeMedia",
    timestamps: false,
    indexes: [
      { fields: ["CrimeId"] },
      { fields: ["fileType"] },
      { fields: ["visibility"] },
      { fields: ["CrimeId", "visibility"] },
    ],
  });

  CrimeMedia.associate = (models) => {
    // CrimeMedia belongs to a Crime
    CrimeMedia.belongsTo(models.Crime, {
      foreignKey: "CrimeId",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return CrimeMedia;
};