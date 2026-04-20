// src/routes.js
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

/**
 * ProtectedRoute: generic wrapper for protecting routes.
 * usage: <Route element={<ProtectedRoute allowedRoles={['admin']} />} >
 */
export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    // If not logged in, redirect to a generic login page or role-specific page
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0) {
    // ensure user's role is allowed
    if (!user || !allowedRoles.includes(user.role)) {
      // redirect to unauthorized page or homepage
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // allowed: render nested routes (Outlet)
  return <Outlet />;
};
