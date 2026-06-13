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
  updateProfile,
  getMyReports,
} from "../controllers/citizenAuthController.js";
import { authorizeCitizen } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Public Routes (No authentication required)
 */

// Register new citizen
router.post("/register", registerCitizen);

// Login citizen
router.post("/login", loginCitizen);

// Google OAuth authentication
router.post("/google-auth", googleAuthCitizen);

/**
 * Protected Routes (Authentication required)
 *
 * These routes use the authorizeCitizen middleware to verify the Supabase JWT token
 * and attach user info to req.user
 */

// Get current user profile
router.get("/profile", authorizeCitizen, getProfile);

// Update user profile
router.put("/profile", authorizeCitizen, updateProfile);

// Get user's submitted reports
router.get("/my-reports", authorizeCitizen, getMyReports);

export default router;
