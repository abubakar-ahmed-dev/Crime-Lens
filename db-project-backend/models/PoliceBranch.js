import DataTypes from "sequelize";

export default (sequelize) => {
  const PoliceBranch = sequelize.define("PoliceBranch", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    branchHeadUserId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    zoneId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    contactNumber: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    location: {
      type: DataTypes.GEOMETRY("POINT", 4326),
      allowNull: false,
    },
  }, {
    tableName: "PoliceBranch",
    timestamps: false,
    indexes: [
      { fields: ["location"], using: "GIST" },
    ],
  });

  PoliceBranch.associate = (models) => {
    PoliceBranch.belongsTo(models.User, { foreignKey: "branchHeadUserId", onDelete: "SET NULL", onUpdate: "CASCADE" });
    PoliceBranch.belongsTo(models.Zone, { foreignKey: "zoneId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
    PoliceBranch.hasMany(models.PoliceAgentRequest, { foreignKey: "branchId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  };

  return PoliceBranch;
};
