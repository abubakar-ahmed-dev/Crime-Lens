import DataTypes  from "sequelize";

export default (sequelize) => {
  const UploadLog = sequelize.define("UploadLog", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    filename: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.ENUM("completed", "failed"),
      allowNull: false,
      defaultValue: "completed",
    },
    totalRecords: {
      type: DataTypes.INTEGER,
    },
    recordsUploaded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: "UploadLog",
    timestamps: false,
  });

  return UploadLog;
};
