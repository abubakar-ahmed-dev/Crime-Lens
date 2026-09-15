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
import { validate } from "../middleware/validationMiddleware.js";
import { crimeReportSchema } from "../validators/schemas.js";

const router = express.Router();

const policeOnly = [verifyToken, authorizeRoles("police")];

// Crime Reporting (Citizen) — per-user write limit + schema validation
router.post(
  "/report-crime",
  authorizeCitizen,
  applyRateLimit("crimeReport"),
  validate(crimeReportSchema),
  reportCrime
);

// Crime Verification (Police Officer)
router.get("/pending", policeOnly, getPendingSubmissions);
router.post("/approve/:submissionId", policeOnly, approveCrimeReport);
router.post("/reject/:submissionId", policeOnly, rejectCrimeReport);


export default router;
