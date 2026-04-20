// import DataTypes from "sequelize";

// export default (sequelize) => {
//   const CrimeSubmission = sequelize.define("CrimeSubmission", {
//     id: {
//       type: DataTypes.BIGINT,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     submitterCnic: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//     zoneId: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//     },
//     incidentDate: {
//       type: DataTypes.DATE,
//       allowNull: true,
//     },
//     description: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//     submittedAt: {
//       type: DataTypes.DATE,
//       allowNull: true,
//       defaultValue: DataTypes.NOW,
//     },
//     status: {
//       type: DataTypes.ENUM("pending", "approved", "rejected"),
//       allowNull: true,
//       defaultValue: "pending",
//     },
//     CrimeId: {
//       type: DataTypes.BIGINT,
//       allowNull: true,
//     },
//     crimeTypeId: {
//       type: DataTypes.BIGINT,
//       allowNull: true,
//     },
//   }, {
//     tableName: "CrimeSubmission",
//     timestamps: false,
//   });

//   CrimeSubmission.associate = (models) => {
//     CrimeSubmission.belongsTo(models.CrimeReportsSubmitter, { foreignKey: "submitterCnic", onDelete: "SET NULL", onUpdate: "CASCADE" });
//     CrimeSubmission.belongsTo(models.Zone, { foreignKey: "zoneId", onDelete: "SET NULL", onUpdate: "CASCADE" });
//     CrimeSubmission.belongsTo(models.Crime, { foreignKey: "CrimeId", onDelete: "SET NULL", onUpdate: "CASCADE" });
//     CrimeSubmission.belongsTo(models.CrimeType, { foreignKey: "crimeTypeId", onDelete: "SET NULL", onUpdate: "CASCADE" });
//   };

//   return CrimeSubmission;
// };



import DataTypes from "sequelize";

export default (sequelize) => {
  const CrimeSubmission = sequelize.define("CrimeSubmission", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    submitterCnic: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    CrimeId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

  }, {
    tableName: "CrimeSubmission",
    timestamps: false,
  });

  CrimeSubmission.associate = (models) => {
    CrimeSubmission.belongsTo(models.CrimeReportsSubmitter, { foreignKey: "submitterCnic", onDelete: "SET NULL", onUpdate: "CASCADE" });

    CrimeSubmission.belongsTo(models.Crime, { foreignKey: "CrimeId", onDelete: "SET NULL", onUpdate: "CASCADE" });

  };

  return CrimeSubmission;
};
