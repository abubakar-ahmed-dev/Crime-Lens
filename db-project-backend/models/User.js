import DataTypes  from "sequelize";

export default (sequelize) => {
  const User = sequelize.define("User", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "User",
  });

  User.associate = (models) => {
    User.belongsTo(models.Role, { foreignKey: "roleId", onDelete: "RESTRICT", onUpdate: "CASCADE" });
    User.hasMany(models.PoliceBranch, { foreignKey: "branchHeadUserId", onDelete: "SET NULL", onUpdate: "CASCADE" });
    User.hasMany(models.PoliceAgentRequest, { foreignKey: "userId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  };

  return User;
};
