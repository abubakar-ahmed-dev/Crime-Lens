// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";

/**
 * Verify JWT Token (for Admin/Police users)
 * Checks Authorization header for Bearer token and validates it
 */
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid token" });
  }
};

/**
 * Authorize Roles (for Admin/Police users)
 * Checks if authenticated user has one of the allowed roles
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(403).json({
        success: false,
        message: "Access denied: no role found",
      });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: insufficient permissions",
      });
    }

    next();
  };
};

/**
 * Authorize Citizen
 * Checks if the request is from an authenticated citizen (Supabase token)
 * Verifies the Supabase JWT and attaches user info to req.user
 */
export const authorizeCitizen = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No authorization token provided",
        message: "No authorization token provided",
      });
    }

    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        message: "Invalid or expired token",
      });
    }

    // Check if email is verified (only applies to email/password signups, not OAuth)
    // The email_confirmed_at field is null when email is not verified
    if (!data.user.email_confirmed_at && !data.user.app_metadata?.provider) {
      return res.status(403).json({
        success: false,
        error: "Please verify your email first. Check your inbox for the verification link.",
        message: "Please verify your email first. Check your inbox for the verification link.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // Attach user info to req.user for the controller to use
    req.user = {
      id: data.user.id,
      email: data.user.email,
      emailVerified: !!data.user.email_confirmed_at,
      authType: "supabase",
      provider: data.user.app_metadata?.provider || "email",
    };

    next();
  } catch (error) {
    console.error("Citizen auth error:", error);
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Unauthorized",
    });
  }
};

/**
 * Combined Authorization
 * Allows access for either Admin/Police (JWT) OR Citizens (Supabase)
 */
export const authorizeAny = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No authorization token provided" });
  }

  // Try JWT verification first (Admin/Police)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.authType = "jwt";
    return next();
  } catch (jwtError) {
    // JWT failed, might be Supabase token
    // Let the controller handle Supabase verification
    req.authType = "supabase";
    return next();
  }
};

/**
 * Optional Authentication
 * If token is provided, verify and set req.user
 * If no token, continue without req.user (defaults to citizen access)
 */
export const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    // No token provided - continue as unauthenticated citizen
    return next();
  }

  // Try JWT verification (Admin/Police)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.authType = "jwt";
    return next();
  } catch {
    // JWT failed - might be Supabase token, try Supabase verification
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        req.user = {
          id: data.user.id,
          role: 'citizen',
          email: data.user.email,
        };
        req.authType = "supabase";
      }
    } catch {
      // Both auth methods failed - continue without req.user (citizen default)
    }
    return next();
  }
};
