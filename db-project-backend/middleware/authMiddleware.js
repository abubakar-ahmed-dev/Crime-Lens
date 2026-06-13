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
      return res.status(401).json({ error: "No authorization token provided" });
    }

    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach user info to req.user for the controller to use
    req.user = {
      id: data.user.id,
      email: data.user.email,
      authType: "supabase",
    };

    next();
  } catch (error) {
    console.error("Citizen auth error:", error);
    return res.status(401).json({ error: "Unauthorized" });
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
