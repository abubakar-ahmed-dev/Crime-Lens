import sequelize from "../config/db.js";

// Import all models
import RoleModel from "./Role.js";
import UserModel from "./User.js";
import ZoneModel from "./Zone.js";
import PoliceBranchModel from "./PoliceBranch.js";
import CrimeTypeModel from "./CrimeType.js";
import CrimeModel from "./Crime.js";
import CrimeReportsSubmitterModel from "./CrimeReportsSubmitter.js";
import CrimeSubmissionModel from "./CrimeSubmission.js";
import PoliceAgentRequestsTempModel from "./PoliceAgentRequestsTemp.js";
import PoliceAgentRequestModel from "./PoliceAgentRequest.js";
import UploadLogModel from "./UploadLog.js";

// Initialize models
const models = {
  Role: RoleModel(sequelize),
  User: UserModel(sequelize),
  Zone: ZoneModel(sequelize),
  PoliceBranch: PoliceBranchModel(sequelize),
  CrimeType: CrimeTypeModel(sequelize),
  Crime: CrimeModel(sequelize),
  CrimeReportsSubmitter: CrimeReportsSubmitterModel(sequelize),
  CrimeSubmission: CrimeSubmissionModel(sequelize),
  PoliceAgentRequestsTemp: PoliceAgentRequestsTempModel(sequelize),
  PoliceAgentRequest: PoliceAgentRequestModel(sequelize),
  UploadLog: UploadLogModel(sequelize),
};

// Run associations
Object.values(models).forEach((model) => {
  if (typeof model.associate === "function") {
    model.associate(models);
  }
});

// Export db object
const db = {
  sequelize,
  ...models,
};

export default db;
