// routes/authRoutes.js
import express from "express";
import { login } from "../controllers/authControllers.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { loginSchema } from "../validators/schemas.js";

const router = express.Router();

// POST /api/auth/login — strict limit (brute-force protection) + schema validation
router.post("/login", applyRateLimit("authLogin"), validate(loginSchema), login);

// (Optional) you could add /register if needed later
// router.post("/register", registerController);

export default router;
