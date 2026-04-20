// routes/crimeRoutes.js
import express from "express";
import { getCrimeById, getAllCrimeTypes, getAllCrimes, getCrimesForMap, updateCrime, deleteCrime, } from "../controllers/CrimeControllers2.js";

const router = express.Router();

router.get(
  "/",
  getCrimesForMap
);

router.get(
  "/all",
  getAllCrimes
);

router.get(
  "/types",
  getAllCrimeTypes
);

// GET full details of a single crime
router.get("/get-crime/:id", getCrimeById);


router.put("/update/:id", updateCrime);


router.delete(
  "/delete/:id",
  deleteCrime
);

export default router;
