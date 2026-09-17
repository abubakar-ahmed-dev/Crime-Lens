import express from "express";
import { getJobStatus, getAllQueueStatus } from "../controllers/jobController.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

const adminOnly = [verifyToken, authorizeRoles("admin")];

// Queue depth overview
router.get("/queues", adminOnly, getAllQueueStatus);

// Individual job status
router.get("/status/:jobId", adminOnly, getJobStatus);

export default router;
