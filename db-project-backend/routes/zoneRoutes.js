// backend/routes/zoneRoutes.js
import express from "express";
import { getZoneSeverity , getAllZones } from "../controllers/zoneController.js";

const router = express.Router();

// GET /api/zones/severity
router.get("/severity", getZoneSeverity);

router.get("/", getAllZones);

export default router;
