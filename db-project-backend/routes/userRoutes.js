import express from "express";
import {
  // searchCrimes,
  reportCrime,
  getPendingSubmissions,
  approveCrimeReport,
  rejectCrimeReport,
} from "../controllers/CrimeControllers.js";
import { authorizeCitizen, verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";

const router = express.Router();

const policeOnly = [verifyToken, authorizeRoles("police")];

// Crime Reporting (Citizen) — per-user write limit
router.post("/report-crime", authorizeCitizen, applyRateLimit("crimeReport"), reportCrime);

// Crime Verification (Police Officer)
router.get("/pending", policeOnly, getPendingSubmissions);
router.post("/approve/:submissionId", policeOnly, approveCrimeReport);
router.post("/reject/:submissionId", policeOnly, rejectCrimeReport);


export default router;
