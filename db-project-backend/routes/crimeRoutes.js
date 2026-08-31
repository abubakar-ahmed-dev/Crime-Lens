// routes/crimeRoutes.js
import express from "express";
import { getCrimeById, getAllCrimeTypes, getAllCrimes, getCrimesForMap, updateCrime, deleteCrime, } from "../controllers/CrimeControllers.js";
import { verifyToken, authorizeRoles, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();
const policeOnly = [verifyToken, authorizeRoles("police")];

router.get(
  "/",
  optionalAuth,
  getCrimesForMap
);
// Query params: mode, crimeType, zoneId, startDate, endDate, lat, lng, radius
// Pagination (opt-in): page, limit — omitting both returns the legacy
// unpaginated array; supplying either returns { success, data, pagination }
// with media capped at 3 per crime.

router.get(
  "/all",
  policeOnly,
  getAllCrimes
);
// Pagination (opt-in): page, limit — omitting both returns the legacy
// { success, data } full dataset; supplying either paginates with metadata.

router.get(
  "/types",
  getAllCrimeTypes
);

// GET full details of a single crime
router.get("/get-crime/:id", policeOnly, getCrimeById);


router.put("/update/:id", policeOnly, updateCrime);


router.delete(
  "/delete/:id",
  policeOnly,
  deleteCrime
);

export default router;
