/**
 * Citizen Authentication Controller
 *
 * Handles citizen user registration, login, profile management,
 * and report tracking using Supabase Auth.
 */

import { supabase } from "../config/supabase.js";
import db from "../models/index.js";
const { sequelize, CrimeReportsSubmitter } = db;

/**
 * POST /api/citizens/register
 * Register a new citizen user
 */
export const registerCitizen = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: "Missing required fields: email, password, fullName",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Password validation (min 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if email already exists in local database
    const existingUser = await CrimeReportsSubmitter.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (authError) {
      // Log the full error for debugging
      console.error("Supabase auth error:", authError);

      // Handle duplicate email
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        return res.status(409).json({ error: "Email already registered" });
      }

      // Handle rate limit errors
      if (authError.status === 429 || authError.code === "over_email_send_rate_limit") {
        return res.status(429).json({
          error: "Too many registration attempts. Please wait a few minutes before trying again.",
          retryLater: true,
        });
      }

      // Return the actual error message from Supabase
      return res.status(400).json({
        error: authError.message || "Registration failed",
        details: authError,
      });
    }

    // Create profile in CrimeReportsSubmitter table
    // Use a temporary CNIC placeholder (user will complete profile later)
    const tempCnic = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const submitter = await CrimeReportsSubmitter.create({
      submitterCnic: tempCnic,
      supabaseUserId: authData.user?.id || null,
      email,
      fullName,
      isProfileComplete: false,
    });

    res.status(201).json({
      message: "Registration successful. Please complete your profile.",
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        isProfileComplete: submitter.isProfileComplete,
      },
      session: authData.session ? {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresIn: authData.session.expires_in,
      } : null,
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle Sequelize unique constraint errors
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors?.[0]?.path;
      if (field === "email") {
        return res.status(409).json({ error: "Email already registered" });
      }
      return res.status(409).json({ error: `${field} already exists` });
    }

    res.status(500).json({ error: "Failed to register user" });
  }
};

/**
 * POST /api/citizens/login
 * Authenticate a citizen user
 */
export const loginCitizen = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Missing required fields: email, password",
      });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes("Invalid")) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      return res.status(400).json({ error: authError.message });
    }

    // Fetch user profile from database
    const submitter = await CrimeReportsSubmitter.findOne({
      where: { email },
    });

    if (!submitter) {
      return res.status(404).json({ error: "User profile not found" });
    }

    res.json({
      message: "Login successful",
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
      },
      session: {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresIn: authData.session.expires_in,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to authenticate user" });
  }
};

/**
 * POST /api/citizens/google-auth
 * Authenticate with Google OAuth
 * This endpoint is called after Supabase OAuth callback to create/update local user profile
 */
export const googleAuthCitizen = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing access token" });
    }

    // Get the Supabase user using the access token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Error getting user from token:", userError);
      return res.status(401).json({ error: "Invalid access token" });
    }

    // Extract user info
    const email = user.email;
    const fullName = user.user_metadata?.full_name ||
                     user.user_metadata?.name ||
                     user.user_metadata?.full_name ||
                     "";
    const supabaseUserId = user.id;

    // Check if user exists in our database by supabaseUserId (most reliable for OAuth)
    let submitter = await CrimeReportsSubmitter.findOne({
      where: { supabaseUserId },
    });

    // If not found by supabaseUserId, check by email (handles email changes)
    if (!submitter && email) {
      submitter = await CrimeReportsSubmitter.findOne({
        where: { email },
      });
      // Update supabaseUserId if found by email but missing supabaseUserId
      if (submitter && !submitter.supabaseUserId) {
        await submitter.update({ supabaseUserId });
      }
    }

    // Create profile if it doesn't exist
    if (!submitter) {
      const tempCnic = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      submitter = await CrimeReportsSubmitter.create({
        submitterCnic: tempCnic,
        supabaseUserId,
        email,
        fullName,
        isProfileComplete: false,
      });
    }

    res.json({
      message: "Google authentication successful",
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);

    // Handle unique constraint errors - user already exists
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors?.[0]?.path;

      // Try to find the existing user and return their profile
      try {
        let submitter;
        if (field === "supabaseUserId") {
          const { data: { user } } = await supabase.auth.getUser(req.body.accessToken);
          if (user) {
            submitter = await CrimeReportsSubmitter.findOne({
              where: { supabaseUserId: user.id },
            });
          }
        } else if (field === "email") {
          const { data: { user } } = await supabase.auth.getUser(req.body.accessToken);
          if (user) {
            submitter = await CrimeReportsSubmitter.findOne({
              where: { email: user.email },
            });
          }
        }

        if (submitter) {
          return res.json({
            message: "Google authentication successful",
            user: {
              id: submitter.submitterCnic,
              email: submitter.email,
              fullName: submitter.fullName,
              contact: submitter.contact,
              cnic: submitter.submitterCnic,
              address: submitter.address,
              isProfileComplete: submitter.isProfileComplete,
            },
          });
        }
      } catch (retryError) {
        console.error("Retry error:", retryError);
      }

      return res.status(409).json({ error: `${field} already exists` });
    }

    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
};

/**
 * GET /api/citizens/profile
 * Get current user's profile (protected route)
 */
export const getProfile = async (req, res) => {
  try {
    // User ID should be attached to req by auth middleware
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const submitter = await CrimeReportsSubmitter.findOne({
      where: { submitterCnic: userId },
    });

    if (!submitter) {
      return res.status(404).json({ error: "User profile not found" });
    }

    res.json({
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

/**
 * PUT /api/citizens/profile
 * Update user's profile (protected route)
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { cnic, contact, address } = req.body;

    // CNIC format validation: XXXXX-XXXXXXX-X
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (cnic && !cnicRegex.test(cnic)) {
      return res.status(400).json({ error: "Invalid CNIC format. Use: XXXXX-XXXXXXX-X" });
    }

    const submitter = await CrimeReportsSubmitter.findOne({
      where: { submitterCnic: userId },
    });

    if (!submitter) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // Update fields
    const updates = {};
    if (cnic) {
      // Check if CNIC is already taken by another user
      const existing = await CrimeReportsSubmitter.findOne({
        where: { submitterCnic: cnic },
      });
      if (existing && existing.submitterCnic !== userId) {
        return res.status(409).json({ error: "CNIC already registered" });
      }
      updates.submitterCnic = cnic;
    }
    if (contact) updates.contact = contact;
    if (address) updates.address = address;

    // Check if profile is complete
    const hasCnic = cnic || submitter.submitterCnic && !submitter.submitterCnic.startsWith("temp_");
    const hasContact = contact || submitter.contact;
    const hasAddress = address || submitter.address;

    if (hasCnic && hasContact && hasAddress) {
      updates.isProfileComplete = true;
    }

    await submitter.update(updates);

    res.json({
      message: "Profile updated successfully",
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

/**
 * GET /api/citizens/my-reports
 * Get all reports submitted by the current user (protected route)
 */
export const getMyReports = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Raw SQL query to get user's reports with crime details
    const [results] = await sequelize.query(`
      SELECT
        c."id",
        c."title",
        c."description",
        c."incidentDate",
        c."reportedAt",
        c."status",
        c."address" as crimeAddress,
        ct."name" as crimeType,
        ct."severity",
        z."name" as zoneName,
        cs."submittedAt"
      FROM "CrimeSubmission" cs
      JOIN "Crime" c ON cs."CrimeId" = c."id"
      LEFT JOIN "CrimeType" ct ON c."crimeTypeId" = ct."id"
      LEFT JOIN "Zone" z ON c."zoneId" = z."id"
      WHERE cs."userId" = :userId
      ORDER BY cs."submittedAt" DESC
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT,
    });

    res.json({
      reports: results,
      total: results.length,
    });
  } catch (error) {
    console.error("Get my reports error:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

export default {
  registerCitizen,
  loginCitizen,
  googleAuthCitizen,
  getProfile,
  updateProfile,
  getMyReports,
};
