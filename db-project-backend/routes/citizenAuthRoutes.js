/**
 * Citizen Authentication Routes
 *
 * API endpoints for citizen user authentication and profile management.
 */

import express from "express";
import {
  registerCitizen,
  loginCitizen,
  googleAuthCitizen,
  getProfile,
  completeProfile,
  updateProfile,
  getMyReports,
} from "../controllers/citizenAuthController.js";
import { authorizeCitizen } from "../middleware/authMiddleware.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import {
  citizenRegisterSchema,
  citizenLoginSchema,
  googleAuthSchema,
} from "../validators/schemas.js";

const router = express.Router();

/**
 * Public Routes (No authentication required)
 */

// Register new citizen
router.post(
  "/register",
  applyRateLimit("citizenAuth"),
  validate(citizenRegisterSchema),
  registerCitizen
);

// Login citizen
router.post(
  "/login",
  applyRateLimit("citizenAuth"),
  validate(citizenLoginSchema),
  loginCitizen
);

// Google OAuth authentication
router.post(
  "/google-auth",
  applyRateLimit("citizenAuth"),
  validate(googleAuthSchema),
  googleAuthCitizen
);

/**
 * Protected Routes (Authentication required)
 *
 * These routes use the authorizeCitizen middleware to verify the Supabase JWT token
 * and attach user info to req.user
 */

// Get current user profile
router.get("/profile", authorizeCitizen, getProfile);

// Complete user profile
router.put("/profile", authorizeCitizen, completeProfile);

// Update user profile (fullName, contact, address)
router.put("/update-profile", authorizeCitizen, updateProfile);

// Get user's submitted reports
router.get("/my-reports", authorizeCitizen, getMyReports);

export default router;
