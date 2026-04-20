import express from "express";
import {
  // searchCrimes,
  reportCrime,
  getPendingSubmissions,
  approveCrimeReport,
  rejectCrimeReport,
} from "../controllers/CrimeControllers2.js";

const router = express.Router();

// Crime Reporting (Public)
router.post("/report-crime", reportCrime);

// Crime Verification (Police Officer)
router.get("/pending", getPendingSubmissions);
router.post("/approve/:submissionId", approveCrimeReport);
router.post("/reject/:submissionId", rejectCrimeReport);


export default router;