/**
 * Citizen Authentication Controller
 *
 * Handles citizen user registration, login, profile management,
 * and report tracking using Supabase Auth.
 */

import { supabase } from "../config/supabase.js";
import db from "../models/index.js";
import { success, errors, validationError, asyncHandler } from "../utils/apiResponse.js";
const { sequelize, CrimeReportsSubmitter } = db;

/**
 * POST /api/citizens/register
 * Register a new citizen user
 */
export const registerCitizen = asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body;

  // Validate required fields
  if (!email || !password || !fullName) {
    return validationError(res, ['email', 'password', 'fullName'], 'Missing required fields');
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return validationError(res, 'email', 'Invalid email format');
  }

  // Password validation (min 6 characters)
  if (password.length < 6) {
    return validationError(res, 'password', 'Password must be at least 6 characters');
  }

  // Check if email already exists in local database
  const existingUser = await CrimeReportsSubmitter.findOne({
    where: { email },
  });

  if (existingUser) {
    return errors.conflict(res, 'Email already registered');
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
    // Handle duplicate email
    if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
      return errors.conflict(res, 'Email already registered');
    }

    // Handle rate limit errors
    if (authError.status === 429 || authError.code === "over_email_send_rate_limit") {
      return errors.tooManyRequests(res, 'Too many registration attempts. Please wait a few minutes before trying again.');
    }

    // Return the actual error message from Supabase
    return errors.badRequest(res, authError.message || 'Registration failed');
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

  return success(res, {
    data: {
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
    },
    message: 'Registration successful. Please complete your profile.',
    statusCode: 201,
  });
});

/**
 * POST /api/citizens/login
 * Authenticate a citizen user
 */
export const loginCitizen = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return validationError(res, ['email', 'password'], 'Missing required fields');
  }

  // Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    if (authError.message.includes("Invalid")) {
      return errors.unauthorized(res, 'Invalid credentials');
    }
    return errors.badRequest(res, authError.message);
  }

  // Fetch user profile from database
  const submitter = await CrimeReportsSubmitter.findOne({
    where: { email },
  });

  if (!submitter) {
    return errors.notFound(res, 'User profile not found');
  }

  return success(res, {
    data: {
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
    },
    message: 'Login successful',
  });
});

/**
 * POST /api/citizens/google-auth
 * Authenticate with Google OAuth
 * This endpoint is called after Supabase OAuth callback to create/update local user profile
 */
export const googleAuthCitizen = asyncHandler(async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return validationError(res, 'accessToken', 'Missing access token');
  }

  // Get the Supabase user using the access token
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return errors.unauthorized(res, 'Invalid access token');
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

  return success(res, {
    message: 'Google authentication successful',
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
});

/**
 * GET /api/citizens/profile
 * Get current user's profile (protected route)
 */
export const getProfile = asyncHandler(async (req, res) => {
  // User email should be attached to req by auth middleware
  const userEmail = req.user?.email;

  if (!userEmail) {
    return errors.unauthorized(res);
  }

  // Find user by email (link between Supabase and database)
  const submitter = await CrimeReportsSubmitter.findOne({
    where: { email: userEmail },
  });

  if (!submitter) {
    return errors.notFound(res, 'User profile not found');
  }

  return success(res, {
    data: {
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
      },
    },
  });
});

/**
 * PUT /api/citizens/profile
 * Update user's profile (protected route)
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    return errors.unauthorized(res);
  }

  const { cnic, contact, address } = req.body;

  // CNIC format validation: XXXXX-XXXXXXX-X
  const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
  if (cnic && !cnicRegex.test(cnic)) {
    return validationError(res, 'cnic', 'Invalid CNIC format. Use: XXXXX-XXXXXXX-X');
  }

  // Find user by email (link between Supabase and database)
  const submitter = await CrimeReportsSubmitter.findOne({
    where: { email: userEmail },
  });

  if (!submitter) {
    return errors.notFound(res, 'User profile not found');
  }

  // Update fields
  const updates = {};
  if (cnic) {
    // Check if CNIC is already taken by another user
    const existing = await CrimeReportsSubmitter.findOne({
      where: { submitterCnic: cnic },
    });
    if (existing && existing.email !== userEmail) {
      return errors.conflict(res, 'CNIC already registered');
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

  return success(res, {
    data: {
      user: {
        id: submitter.submitterCnic,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
      },
    },
    message: 'Profile updated successfully',
  });
});

/**
 * GET /api/citizens/my-reports
 * Get all reports submitted by the current user (protected route)
 */
export const getMyReports = asyncHandler(async (req, res) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    return errors.unauthorized(res);
  }

  // First, get the submitter's CNIC from email (link between Supabase and database)
  const submitter = await CrimeReportsSubmitter.findOne({
    where: { email: userEmail },
  });

  if (!submitter) {
    return errors.notFound(res, 'User profile not found');
  }

  // Use submitterCnic as userId in CrimeSubmission table
  const userId = submitter.submitterCnic;

  // Raw SQL query to get user's reports with crime details
  // Returns empty array if no reports found (not an error)
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

  // Handle empty results - return empty array, not an error
  const reports = results || [];

  return success(res, {
    data: {
      reports: reports,
      total: reports.length,
    },
  });
});

export default {
  registerCitizen,
  loginCitizen,
  googleAuthCitizen,
  getProfile,
  updateProfile,
  getMyReports,
};
