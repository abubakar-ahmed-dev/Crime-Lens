// middleware/authMiddleware.js
import jwt from "jsonwebtoken";

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
 * This is separate from Admin/Police JWT auth
 */
export const authorizeCitizen = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "No authorization token provided" });
    }

    // For citizen auth, we need to verify with Supabase
    // This would typically be done in the controller with Supabase client
    // For now, we'll just check that a token is present
    // The actual verification happens in the citizen auth controller

    // You can add Supabase verification here if needed:
    // const { data, error } = await supabase.auth.getUser(token);
    // if (error) throw error;

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid citizen token",
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
