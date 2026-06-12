import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../context/AuthContext";

/**
 * AuthCallback Component
 *
 * Handles the OAuth callback from Google (and other OAuth providers).
 * This component:
 * 1. Extracts the access_token and refresh_token from the URL hash/params
 * 2. Uses them to establish a Supabase session
 * 3. Redirects the user to the appropriate page
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Supabase will automatically handle the OAuth tokens from the URL
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("OAuth callback error:", error);
          setError("Authentication failed. Please try again.");
          setTimeout(() => navigate("/login-citizen"), 3000);
          return;
        }

        if (!data.session) {
          // Try to get session from URL parameters
          const params = new URLSearchParams(window.location.hash);
          const accessToken = params.get("access_token");

          if (!accessToken) {
            setError("No authentication data found. Please try again.");
            setTimeout(() => navigate("/login-citizen"), 3000);
            return;
          }

          // Set the session using the tokens from URL
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: params.get("access_token") || "",
            refresh_token: params.get("refresh_token") || "",
          });

          if (sessionError) {
            console.error("Session setup error:", sessionError);
            setError("Failed to establish session. Please try again.");
            setTimeout(() => navigate("/login-citizen"), 3000);
            return;
          }

          // Get user profile from backend
          const user = sessionData.user;
          if (user) {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
            const response = await fetch(`${API_BASE}/citizens/google-auth`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: params.get("access_token"),
              }),
            });

            if (response.ok) {
              const profileData = await response.json();
              // Store user profile in localStorage
              localStorage.setItem("citizen", JSON.stringify(profileData.user));
              localStorage.setItem("citizen_session", JSON.stringify(sessionData.session));
              localStorage.setItem("citizen_token", sessionData.session.access_token);

              // Redirect based on profile completion
              if (profileData.user.isProfileComplete) {
                navigate("/citizen-dashboard");
              } else {
                navigate("/complete-profile");
              }
            } else {
              // Profile creation might have failed, but session is established
              navigate("/complete-profile");
            }
          }
        } else {
          // Session already exists, get profile and redirect
          const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
          const response = await fetch(`${API_BASE}/citizens/profile`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
          });

          if (response.ok) {
            const profileData = await response.json();
            localStorage.setItem("citizen", JSON.stringify(profileData.user));

            if (profileData.user.isProfileComplete) {
              navigate("/citizen-dashboard");
            } else {
              navigate("/complete-profile");
            }
          } else {
            // Profile fetch failed, redirect to complete profile
            navigate("/complete-profile");
          }
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError("An unexpected error occurred. Please try again.");
        setTimeout(() => navigate("/login-citizen"), 3000);
      } finally {
        setLoading(false);
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
