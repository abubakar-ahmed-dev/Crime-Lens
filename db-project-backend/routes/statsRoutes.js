// // routes/crimeTypes.js
// import express from "express";
// import {overview , pie, bar, line } from "../controllers/statsController.js";

// const router = express.Router();


// // overview
// router.get("/overview", overview);

// // pie chart data
// router.get("/pie", pie);

// // bar chart data
// router.get("/bar", bar);

// // line chart data
// router.get("/line", line);

// export default router;

import express from "express";
import {
  getStatsSummary,
  getCrimesByType,
  getCrimesByZone,
  getCrimeTrend,
} from "../controllers/statsController.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { statsQuerySchema } from "../validators/schemas.js";

const router = express.Router();

// Summary for StatsCards
router.get("/summary", applyRateLimit("publicAPI"), getStatsSummary);

// Pie chart — crimes by type
router.get(
  "/crime-type-distribution",
  applyRateLimit("publicAPI"),
  validate(statsQuerySchema, "query"),
  getCrimesByType
);

// Bar chart — crimes per zone
router.get(
  "/zone-crime-count",
  applyRateLimit("publicAPI"),
  validate(statsQuerySchema, "query"),
  getCrimesByZone
);

// Line chart — trend of a crime
router.get(
  "/crime-trend",
  applyRateLimit("publicAPI"),
  validate(statsQuerySchema, "query"),
  getCrimeTrend
);

export default router;
