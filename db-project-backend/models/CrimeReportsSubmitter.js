import DataTypes from "sequelize";

/**
 * CrimeReportsSubmitter - Citizen Profile Model
 *
 * This table serves as the citizen profile for authenticated users.
 * Links to Supabase Auth users and stores personal information.
 */
export default (sequelize) => {
  const CrimeReportsSubmitter = sequelize.define("CrimeReportsSubmitter", {
    // Primary identifier (CNIC - National ID card number)
    submitterCnic: {
      type: DataTypes.TEXT,
      primaryKey: true,
      allowNull: false,
    },

    // Supabase Auth integration
    supabaseUserId: {
      type: DataTypes.TEXT,
      unique: true,
      allowNull: true,
      comment: "Links to Supabase Auth user ID",
    },
    email: {
      type: DataTypes.TEXT,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
      },
      comment: "Email address from Supabase Auth",
    },

    // Personal information
    fullName: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Full name of the citizen",
    },
    contact: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Contact phone number",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Residential address",
    },

    // Profile completion status
    isProfileComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: "True when CNIC, contact, and address are provided",
    },

    // Timestamps
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
    tableName: "CrimeReportsSubmitter",
    timestamps: true,
    underscored: false,
  });

  CrimeReportsSubmitter.associate = (models) => {
    CrimeReportsSubmitter.hasMany(models.CrimeSubmission, {
      foreignKey: "submitterCnic",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      as: "submissions",
    });
  };

  return CrimeReportsSubmitter;
};
