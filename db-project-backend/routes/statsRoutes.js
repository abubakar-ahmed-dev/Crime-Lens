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

const router = express.Router();

// Summary for StatsCards
router.get("/summary", getStatsSummary);

// Pie chart — crimes by type
router.get("/crime-type-distribution", getCrimesByType);

// Bar chart — crimes per zone
router.get("/zone-crime-count", getCrimesByZone);

// Line chart — trend of a crime
router.get("/crime-trend", getCrimeTrend);

export default router;
