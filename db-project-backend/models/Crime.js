import DataTypes from "sequelize";

export default (sequelize) => {
  const Crime = sequelize.define("Crime", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    crimeTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    incidentDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    reportedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected", "deleted"),
      allowNull: false,
      defaultValue: "pending",
    },
    location: {
      type: DataTypes.GEOMETRY("POINT", 4326),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
    },
    zoneId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    latestUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mediaCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "mediaCount",
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "thumbnailUrl",
    },
  }, {
    tableName: "Crime",
    timestamps: false,
    indexes: [
      { fields: ["crimeTypeId"] },
      { fields: ["reportedAt"] },
      { fields: ["status"] },
      { fields: ["zoneId", "reportedAt"] },
      { fields: ["location"], using: "GIST" },
    ],
  });

  Crime.associate = (models) => {
    Crime.belongsTo(models.CrimeType, { foreignKey: "crimeTypeId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
    Crime.belongsTo(models.Zone, { foreignKey: "zoneId", onDelete: "SET NULL", onUpdate: "CASCADE" });
    Crime.belongsTo(models.User, { foreignKey: "latestUpdatedBy", as: "latestUpdater", onDelete: "SET NULL", onUpdate: "CASCADE" });
    Crime.hasMany(models.CrimeSubmission, { foreignKey: "CrimeId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
    Crime.hasMany(models.CrimeMedia, { foreignKey: "CrimeId", onDelete: "CASCADE", onUpdate: "CASCADE" });
  };

  return Crime;
};
