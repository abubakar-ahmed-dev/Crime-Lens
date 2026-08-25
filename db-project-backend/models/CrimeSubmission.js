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

    submitterId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: "Stable reference to CrimeReportsSubmitter.id",
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
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  };

  return CrimeSubmission;
};
