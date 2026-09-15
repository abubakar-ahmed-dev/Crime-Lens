// backend/routes/zoneRoutes.js
import express from "express";
import {
  checkLocationInsideZone,
  getAllZones,
  getZoneSeverity,
} from "../controllers/zoneController.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";

const router = express.Router();

// GET /api/zones/severity
router.get("/severity", applyRateLimit("publicAPI"), getZoneSeverity);

router.post("/:id/contains", applyRateLimit("publicAPI"), checkLocationInsideZone);

router.get("/", applyRateLimit("publicAPI"), getAllZones);

export default router;
