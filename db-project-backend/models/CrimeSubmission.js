import DataTypes from "sequelize";

/**
 * CrimeSubmission Model
 *
 * Links crimes to their submitters (citizens).
 * For authenticated citizens, userId is used instead of submitterCnic.
 */
export default (sequelize) => {
  const CrimeSubmission = sequelize.define("CrimeSubmission", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    // Legacy: CNIC-based submission (deprecated, kept for backward compatibility)
    submitterCnic: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Legacy CNIC-based submitter reference (deprecated)",
    },

    // New: User ID-based submission for authenticated citizens
    userId: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "User ID (same as submitterCnic) for authenticated citizen submissions",
    },

    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    CrimeId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: "Reference to the Crime record",
    },
  }, {
    tableName: "CrimeSubmission",
    timestamps: false,
  });

  CrimeSubmission.associate = (models) => {
    // Legacy association via CNIC
    CrimeSubmission.belongsTo(models.CrimeReportsSubmitter, {
      foreignKey: "submitterCnic",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      as: "submitterByCnic",
    });

    // New association via userId (same table, different semantics)
    CrimeSubmission.belongsTo(models.CrimeReportsSubmitter, {
      foreignKey: "userId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      as: "submitterByUser",
    });

    CrimeSubmission.belongsTo(models.Crime, {
      foreignKey: "CrimeId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return CrimeSubmission;
};
