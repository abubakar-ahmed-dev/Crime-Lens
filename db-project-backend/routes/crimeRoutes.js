// routes/crimeRoutes.js
import express from "express";
import { getCrimeById, getAllCrimeTypes, getAllCrimes, getCrimesForMap, updateCrime, deleteCrime, } from "../controllers/CrimeControllers.js";
import { verifyToken, authorizeRoles, optionalAuth } from "../middleware/authMiddleware.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  mapQuerySchema,
  paginationQuerySchema,
  crimeUpdateSchema,
} from "../validators/schemas.js";

const router = express.Router();
const policeOnly = [verifyToken, authorizeRoles("police")];

router.get(
  "/",
  optionalAuth,
  applyRateLimit("publicAPI"),
  validate(mapQuerySchema, "query"),
  getCrimesForMap
);
// Query params: mode, crimeType, zoneId, startDate, endDate, lat, lng, radius
// Pagination (opt-in): page, limit — omitting both returns the legacy
// unpaginated array; supplying either returns { success, data, pagination }
// with media capped at 3 per crime.
// Validation is gate-only (query is read-only in Express 5).

router.get(
  "/all",
  policeOnly,
  validate(paginationQuerySchema, "query"),
  getAllCrimes
);
// Pagination (opt-in): page, limit — omitting both returns the legacy
// { success, data } full dataset; supplying either paginates with metadata.

router.get(
  "/types",
  applyRateLimit("publicAPI"),
  getAllCrimeTypes
);

// GET full details of a single crime
router.get("/get-crime/:id", policeOnly, getCrimeById);


router.put(
  "/update/:id",
  policeOnly,
  applyRateLimit("writeAction"),
  validate(crimeUpdateSchema),
  updateCrime
);


router.delete(
  "/delete/:id",
  policeOnly,
  applyRateLimit("writeAction"),
  deleteCrime
);

export default router;
