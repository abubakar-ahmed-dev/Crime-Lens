import DataTypes  from "sequelize";

export default (sequelize) => {
  const CrimeType = sequelize.define("CrimeType", {
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
    severity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  }, {
    tableName: "CrimeType",
    timestamps: false,
  });

  CrimeType.associate = (models) => {
    CrimeType.hasMany(models.Crime, { foreignKey: "crimeTypeId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
  };

  return CrimeType;
};
