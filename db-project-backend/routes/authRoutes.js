// routes/authRoutes.js
import express from "express";
import { login } from "../controllers/authControllers.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";

const router = express.Router();

// POST /api/auth/login — strict limit (brute-force protection)
router.post("/login", applyRateLimit("authLogin"), login);

// (Optional) you could add /register if needed later
// router.post("/register", registerController);

export default router;
