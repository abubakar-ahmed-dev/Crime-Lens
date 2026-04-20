import DataTypes  from "sequelize";

export default (sequelize) => {
  const PoliceAgentRequestsTemp = sequelize.define("PoliceAgentRequestsTemp", {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "PoliceAgentRequestsTemp",
    timestamps: false,
  });

  PoliceAgentRequestsTemp.associate = (models) => {
    PoliceAgentRequestsTemp.hasMany(models.PoliceAgentRequest, { foreignKey: "policeAgentRequestsTempId", onDelete: "SET NULL", onUpdate: "CASCADE" });
  };

  return PoliceAgentRequestsTemp;
};
