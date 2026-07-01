// routes/crimeRoutes.js
import express from "express";
import { getCrimeById, getAllCrimeTypes, getAllCrimes, getCrimesForMap, updateCrime, deleteCrime, } from "../controllers/CrimeControllers.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();
const policeOnly = [verifyToken, authorizeRoles("police")];

router.get(
  "/",
  getCrimesForMap
);

router.get(
  "/all",
  policeOnly,
  getAllCrimes
);

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
