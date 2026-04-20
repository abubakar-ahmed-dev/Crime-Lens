import DataTypes from "sequelize";

export default (sequelize) => {
  const Zone = sequelize.define("Zone", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    boundary: {
      type: DataTypes.GEOMETRY("POLYGON", 4326),
      allowNull: false,
    },
  }, {
    tableName: "Zone",
    timestamps: false,
    indexes: [
      { fields: ["boundary"], using: "GIST" },
    ],
  });

  Zone.associate = (models) => {
    Zone.hasMany(models.PoliceBranch, { foreignKey: "zoneId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
    Zone.hasMany(models.Crime, { foreignKey: "zoneId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  };

  return Zone;
};
