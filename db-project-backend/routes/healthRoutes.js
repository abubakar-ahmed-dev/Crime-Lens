// routes/healthRoutes.js
import express from "express";
import { processHealth, readinessCheck } from "../controllers/healthController.js";

const router = express.Router();

// GET /api/health — process-alive probe (no dependency checks)
router.get("/health", processHealth);

// GET /api/ready — dependency probe (PostgreSQL now; Redis added in Phase 3)
router.get("/ready", readinessCheck);

export default router;
