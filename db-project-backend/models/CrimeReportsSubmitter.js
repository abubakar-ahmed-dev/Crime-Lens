// const { DataTypes } = require("sequelize");
import DataTypes from "sequelize";

export default (sequelize) => {
  const CrimeReportsSubmitter = sequelize.define("CrimeReportsSubmitter", {
    submitterCnic: {
      type: DataTypes.TEXT,
      primaryKey: true,
    },
    submitterName: {
      type: DataTypes.TEXT,
    },
    submitterContact: {
      type: DataTypes.TEXT,
    },
  }, {
    tableName: "CrimeReportsSubmitter",
    timestamps: false,
  });

  CrimeReportsSubmitter.associate = (models) => {
    CrimeReportsSubmitter.hasMany(models.CrimeSubmission, { foreignKey: "submitterCnic", onDelete: "SET NULL", onUpdate: "CASCADE" });
  };

  return CrimeReportsSubmitter;
};
