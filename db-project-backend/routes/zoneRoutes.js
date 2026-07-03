// backend/routes/zoneRoutes.js
import express from "express";
import {
  checkLocationInsideZone,
  getAllZones,
  getZoneSeverity,
} from "../controllers/zoneController.js";

const router = express.Router();

// GET /api/zones/severity
router.get("/severity", getZoneSeverity);

router.post("/:id/contains", checkLocationInsideZone);

router.get("/", getAllZones);

export default router;
