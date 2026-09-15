// routes/adminRoutes.js
import express from "express";
import { uploadCrimesCSV } from "../controllers/adminControls/UploadControllers.js";
import {
  assignBranchHead,
  createBranch,
  createPoliceAgent,
  getApprovedPoliceAgents,
  getBranches,
} from "../controllers/adminControls/BranchController.js";
import { upload } from "../config/multerConfig.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { branchCreateSchema } from "../validators/schemas.js";

const router = express.Router();
const adminOnly = [verifyToken, authorizeRoles("admin")];

// POST /api/admin/upload-crimes — very strict limit (heavy DB/storage work)

router.post(
  "/upload-crimes",
  ...adminOnly,
  applyRateLimit("adminUpload"),
  upload.single("file"),
  uploadCrimesCSV
);

router.get("/branches", adminOnly, getBranches);
router.post("/branches", adminOnly, validate(branchCreateSchema), createBranch);
router.put("/branches/:branchId/head", adminOnly, assignBranchHead);
router.get("/police-agents", adminOnly, getApprovedPoliceAgents);
router.post("/police-agents", adminOnly, createPoliceAgent);

export default router;
