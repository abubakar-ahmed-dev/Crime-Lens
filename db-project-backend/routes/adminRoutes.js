// routes/adminRoutes.js
import express from "express";
import { uploadCrimesCSV } from "../controllers/adminControls/UploadControllers.js";
import { upload } from "../config/multerConfig.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// POST /api/admin/upload-crimes

router.post(
  "/upload-crimes",
  upload.single("file"),
  uploadCrimesCSV
);


export default router;
