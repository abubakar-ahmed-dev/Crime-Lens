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
 * Note: These routes require middleware to verify the JWT token
 * from Supabase and attach user info to req.user
 * TODO: Implement Supabase JWT verification middleware
 */

// Get current user profile
router.get("/profile", getProfile);

// Update user profile
router.put("/profile", updateProfile);

// Get user's submitted reports
router.get("/my-reports", getMyReports);

export default router;
