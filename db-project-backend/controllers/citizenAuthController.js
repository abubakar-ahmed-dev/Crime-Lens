/**
 * Citizen Authentication Controller
 *
 * Handles citizen user registration, login, profile management,
 * and report tracking using Supabase Auth.
 */

import { supabase, supabaseAdmin } from "../config/supabase.js";
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

  const submitter = await CrimeReportsSubmitter.create({
    submitterCnic: null,
    supabaseUserId: authData.user?.id || null,
    email,
    fullName,
    isProfileComplete: false,
  });

  // Build session object with user data for email verification status
  const sessionWithUser = authData.session ? {
    ...authData.session,
    user: {
      id: authData.user.id,
      email: authData.user.email,
      email_confirmed_at: authData.user.email_confirmed_at,
      app_metadata: authData.user.app_metadata,
    },
  } : null;

  return success(res, {
    data: {
      user: {
        id: submitter.id,
        email: submitter.email,
        fullName: submitter.fullName,
        cnic: submitter.submitterCnic,
        isProfileComplete: submitter.isProfileComplete,
        emailVerified: !!authData.user?.email_confirmed_at,
        provider: authData.user?.app_metadata?.provider || "email",
      },
      session: sessionWithUser,
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
    // Handle email not confirmed error specifically
    if (authError.message.includes("Email not confirmed")) {
      return res.status(403).json({
        success: false,
        error: "Please verify your email first. Check your inbox for the verification link.",
        code: "EMAIL_NOT_VERIFIED"
      });
    }
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

  // Include Supabase user data in session for email verification status
  const sessionWithUser = {
    ...authData.session,
    user: {
      id: authData.user.id,
      email: authData.user.email,
      email_confirmed_at: authData.user.email_confirmed_at,
      app_metadata: authData.user.app_metadata,
    },
  };

  return success(res, {
    data: {
      user: {
        id: submitter.id,
        email: submitter.email,
        fullName: submitter.fullName,
        contact: submitter.contact,
        cnic: submitter.submitterCnic,
        address: submitter.address,
        isProfileComplete: submitter.isProfileComplete,
        emailVerified: !!authData.user.email_confirmed_at,
        provider: authData.user.app_metadata?.provider || "email",
      },
      session: sessionWithUser,
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
  const { accessToken, mode = "login" } = req.body;

  if (!accessToken) {
    return validationError(res, 'accessToken', 'Missing access token');
  }

  if (!["login", "signup"].includes(mode)) {
    return validationError(res, 'mode', 'Invalid Google auth mode');
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

  if (!submitter && mode === "login") {
    if (supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUserId).catch((error) => {
        console.error("Failed to remove unregistered Google auth user:", error);
      });
    }

    return errors.notFound(res, 'No citizen account exists for this Google email. Please sign up first.');
  }

  // Create profile only during signup
  if (!submitter) {
    submitter = await CrimeReportsSubmitter.create({
      submitterCnic: null,
      supabaseUserId,
      email,
      fullName,
      isProfileComplete: false,
    });
  }

  return success(res, {
    message: 'Google authentication successful',
    data: {
      user: {
        id: submitter.id,
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
        id: submitter.id,
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
 * Complete user's profile (protected route)
 */
export const completeProfile = asyncHandler(async (req, res) => {
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
  if (contact) {
    // Check if contact number is already taken by another user
    const existingContact = await CrimeReportsSubmitter.findOne({
      where: { contact },
    });
    if (existingContact && existingContact.email !== userEmail) {
      return errors.conflict(res, 'Contact number already registered');
    }
    updates.contact = contact;
  }
  if (address) updates.address = address;

  // Check if profile is complete
  const hasCnic = cnic || submitter.submitterCnic;
  const hasContact = contact || submitter.contact;
  const hasAddress = address || submitter.address;

  if (hasCnic && hasContact && hasAddress) {
    updates.isProfileComplete = true;
  }

  if (Object.keys(updates).length === 0) {
    return errors.badRequest(res, 'No fields to update');
  }

  await submitter.update(updates);

  // Fetch the updated record to return fresh data
  const updatedSubmitter = await CrimeReportsSubmitter.findOne({
    where: { email: userEmail },
  });

  return success(res, {
    data: {
      user: {
        id: updatedSubmitter.id,
        email: updatedSubmitter.email,
        fullName: updatedSubmitter.fullName,
        contact: updatedSubmitter.contact,
        cnic: updatedSubmitter.submitterCnic,
        address: updatedSubmitter.address,
        isProfileComplete: updatedSubmitter.isProfileComplete,
      },
    },
    message: 'Profile updated successfully',
  });
});

/**
 * PUT /api/citizens/update-profile
 * Update user's profile information (fullName, contact, address)
 * This is separate from completeProfile - used for updating existing profile data
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    return errors.unauthorized(res);
  }

  const { fullName, contact, address } = req.body;

  // Find user by email
  const submitter = await CrimeReportsSubmitter.findOne({
    where: { email: userEmail },
  });

  if (!submitter) {
    return errors.notFound(res, 'User profile not found');
  }

  // Build updates object - only include fields that are provided
  const updates = {};

  if (fullName !== undefined && fullName !== null && fullName !== "") {
    updates.fullName = fullName;
  }

  if (contact !== undefined && contact !== null && contact !== "") {
    // Check if contact number is already taken by another user
    const existingContact = await CrimeReportsSubmitter.findOne({
      where: { contact },
    });

    // If contact exists and belongs to a different user, return error
    if (existingContact && existingContact.email !== userEmail) {
      return errors.conflict(res, 'This contact number is already registered with another account');
    }

    updates.contact = contact;
  }

  if (address !== undefined && address !== null && address !== "") {
    updates.address = address;
  }

  // Check if there's anything to update
  if (Object.keys(updates).length === 0) {
    return errors.badRequest(res, 'No fields to update');
  }

  await submitter.update(updates);

  // Fetch the updated record
  const updatedSubmitter = await CrimeReportsSubmitter.findOne({
    where: { email: userEmail },
  });

  return success(res, {
    data: {
      user: {
        id: updatedSubmitter.id,
        email: updatedSubmitter.email,
        fullName: updatedSubmitter.fullName,
        contact: updatedSubmitter.contact,
        cnic: updatedSubmitter.submitterCnic,
        address: updatedSubmitter.address,
        isProfileComplete: updatedSubmitter.isProfileComplete,
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

  const submitterId = submitter.id;

  // Raw SQL query to get user's reports with crime details
  // Returns empty array if no reports found (not an error)
  const reports = await sequelize.query(`
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
    WHERE cs."submitterId" = :submitterId
    ORDER BY cs."submittedAt" DESC
  `, {
    replacements: { submitterId },
    type: sequelize.QueryTypes.SELECT,
  });

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
  completeProfile,
  updateProfile,
  getMyReports,
};
