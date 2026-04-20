import DataTypes  from "sequelize";

export default (sequelize) => {
  const Role = sequelize.define("Role", {
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
    description: {
      type: DataTypes.TEXT,
    },
  }, {
    tableName: "Role",
    timestamps: false,
  });

  Role.associate = (models) => {
    Role.hasMany(models.User, { foreignKey: "roleId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
  };

  return Role;
};
