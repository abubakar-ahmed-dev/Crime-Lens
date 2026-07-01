import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config/constants";

/**
 * AuthCallback Component
 *
 * Handles both:
 * 1. OAuth callback from Google (and other OAuth providers)
 * 2. Email verification callback from Supabase
 *
 * Manually extracts tokens from URL and establishes Supabase session.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  useEffect(() => {
    // Prevent duplicate processing using a flag in sessionStorage
    const processingKey = "auth_callback_processing";
    if (sessionStorage.getItem(processingKey)) {
      return; // Already processing
    }
    sessionStorage.setItem(processingKey, "true");

    const handleCallback = async () => {
      try {
        // Parse the hash fragment to get tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        const code = queryParams.get("code");
        let accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type"); // 'signup' for email verification, or missing for OAuth
        const hasMode = queryParams.has("mode");
        const mode = queryParams.get("mode") === "signup" ? "signup" : "login";
        let sessionData: any = null;
        let sessionUser: any = null;

        if (!accessToken && !code) {
          setError("No access token found in callback");
          sessionStorage.removeItem(processingKey);
          setTimeout(() => navigate("/login-citizen"), 2000);
          return;
        }

        if (code) {
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

          if (sessionError || !data.session) {
            console.error("Session error:", sessionError);
            setError("Failed to establish session");
            sessionStorage.removeItem(processingKey);
            setTimeout(() => navigate("/login-citizen"), 2000);
            return;
          }

          sessionData = data.session;
          sessionUser = data.user;
          accessToken = data.session.access_token;
        } else {
          // Set the session using the tokens from URL
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken || "",
          });

          if (sessionError || !data.session) {
            console.error("Session error:", sessionError);
            setError("Failed to establish session");
            sessionStorage.removeItem(processingKey);
            setTimeout(() => navigate("/login-citizen"), 2000);
            return;
          }

          sessionData = data.session;
          sessionUser = data.user;
        }

        if (!accessToken) {
          setError("No access token found in callback");
          sessionStorage.removeItem(processingKey);
          setTimeout(() => navigate("/login-citizen"), 2000);
          return;
        }

        // Check if this is an email verification callback
        // Supabase sends type='signup' or similar for email verification
        const isEmailVerification = type === "signup" || type === "email" || (!!code && !hasMode);

        if (isEmailVerification) {
          // This is an email verification callback
          // The email should now be confirmed
          if (sessionUser?.email_confirmed_at || sessionUser?.confirmed_at) {
            setIsEmailVerified(true);
            setLoading(false);

            const response = await fetch(`${API_BASE_URL}/citizens/profile`, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            const profileData = await response.json();

            if (!response.ok || !profileData.user) {
              throw new Error(profileData.error || "Failed to load citizen profile");
            }

            const verifiedCitizen = {
              ...profileData.user,
              emailVerified: true,
              provider: "email",
            };

            localStorage.setItem("citizen", JSON.stringify(verifiedCitizen));
            localStorage.setItem("citizen_session", JSON.stringify(sessionData));
            localStorage.setItem("citizen_token", accessToken);
            localStorage.setItem("userRole", "user");

            // Clear the hash from URL
            window.history.replaceState({}, document.title, window.location.pathname);

            sessionStorage.removeItem(processingKey);

            // Redirect after showing success message
            setTimeout(() => {
              if (verifiedCitizen.isProfileComplete) {
                navigate("/citizen-dashboard");
              } else {
                navigate("/complete-profile");
              }
            }, 2000);
            return;
          } else {
            setError("Email verification failed. Please try again.");
            setTimeout(() => navigate("/login-citizen"), 2000);
            sessionStorage.removeItem(processingKey);
            return;
          }
        }

        // Clear the hash from URL after we've processed the tokens
        window.history.replaceState({}, document.title, window.location.pathname);

        // Create/fetch backend profile for OAuth users
        if (sessionUser) {
          try {
            const response = await fetch(`${API_BASE_URL}/citizens/google-auth`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken, mode }),
            });

            const profileData = await response.json();

            if (response.ok) {
              if (!profileData.user) {
                throw new Error("Google authentication response did not include a user profile");
              }

              // Store in localStorage first
              localStorage.setItem("citizen", JSON.stringify(profileData.user));
              localStorage.setItem("citizen_session", JSON.stringify(sessionData));
              localStorage.setItem("citizen_token", accessToken);
              localStorage.setItem("userRole", "user");

              // Wait a moment for localStorage to be set and state to update
              await new Promise(resolve => setTimeout(resolve, 100));

              // Redirect based on profile completion
              const targetRoute = profileData.user.isProfileComplete ? "/citizen-dashboard" : "/complete-profile";
              navigate(targetRoute);
            } else {
              await supabase.auth.signOut();
              localStorage.removeItem("citizen");
              localStorage.removeItem("citizen_session");
              localStorage.removeItem("citizen_token");
              localStorage.removeItem("userRole");
              setError(profileData.error || profileData.message || "Google authentication failed");
              setTimeout(() => navigate(mode === "signup" ? "/register" : "/login-citizen"), 2500);
            }
          } catch (err) {
            console.error("Backend fetch error:", err);
            setError("Google authentication failed. Please try again.");
            setTimeout(() => navigate(mode === "signup" ? "/register" : "/login-citizen"), 2500);
          }
        } else {
          setError("Failed to get user from session");
          setTimeout(() => navigate("/login-citizen"), 2000);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("An unexpected error occurred");
        setTimeout(() => navigate("/login-citizen"), 2000);
      } finally {
        if (!isEmailVerified) {
          setLoading(false);
        }
        sessionStorage.removeItem(processingKey);
      }
    };

    handleCallback();
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

  if (isEmailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-green-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-4">Your email has been successfully verified. Redirecting to complete your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
