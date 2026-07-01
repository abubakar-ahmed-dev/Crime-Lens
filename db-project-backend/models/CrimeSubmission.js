import DataTypes from "sequelize";

/**
 * CrimeSubmission Model
 *
 * Links crimes to their submitters (citizens).
 * Authenticated citizen ownership uses submitterId.
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
      comment: "CNIC snapshot for display/backward compatibility",
    },

    submitterId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Stable reference to CrimeReportsSubmitter.id",
    },

    // Legacy field retained during migration. Use submitterId for ownership.
    userId: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Legacy user identifier retained for backward compatibility",
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
    CrimeSubmission.belongsTo(models.CrimeReportsSubmitter, {
      foreignKey: "submitterId",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      as: "submitter",
    });

    CrimeSubmission.belongsTo(models.Crime, {
      foreignKey: "CrimeId",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return CrimeSubmission;
};
