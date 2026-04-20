import DataTypes  from "sequelize";

export default (sequelize) => {
  const PoliceAgentRequest = sequelize.define("PoliceAgentRequest", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    policeAgentRequestsTempId: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    userId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "PoliceAgentRequest",
    timestamps: false,
  });

  PoliceAgentRequest.associate = (models) => {
    PoliceAgentRequest.belongsTo(models.PoliceAgentRequestsTemp, { foreignKey: "policeAgentRequestsTempId", onDelete: "SET NULL", onUpdate: "CASCADE" });
    PoliceAgentRequest.belongsTo(models.User, { foreignKey: "userId", onDelete: "SET NULL", onUpdate: "CASCADE" });
    PoliceAgentRequest.belongsTo(models.PoliceBranch, { foreignKey: "branchId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  };

  return PoliceAgentRequest;
};
