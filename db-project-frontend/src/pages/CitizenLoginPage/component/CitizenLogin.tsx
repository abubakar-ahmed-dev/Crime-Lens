import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function CitizenLogin() {
  const navigate = useNavigate();
  const { citizenLogin, citizenGoogleLogin, isCitizenAuthenticated, citizen, resendVerificationEmail } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isCitizenAuthenticated && citizen) {
      if (citizen.isProfileComplete) {
        navigate("/dashboard");
      } else {
        navigate("/complete-profile");
      }
    }
  }, [isCitizenAuthenticated, citizen, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);

    const result = await citizenLogin(formData.email, formData.password);

    setLoading(false);

    if (result.success) {
      // Redirect will be handled by useEffect
    } else {
      setError(result.message || "Login failed");
    }
  };

  const handleGoogleLogin = async () => {
    const result = await citizenGoogleLogin();
    if (!result.success) {
      setError(result.message || "Google login failed");
    }
    // Supabase will handle redirect
  };

  const handleResendVerification = async () => {
    if (!formData.email) {
      setError("Please enter your email address first");
      return;
    }

    setResendingEmail(true);
    setError("");

    const result = await resendVerificationEmail(formData.email);

    setResendingEmail(false);

    if (result.success) {
      setSuccessMessage(result.message || "Verification email sent! Please check your inbox.");
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(""), 5000);
    } else {
      setError(result.message || "Failed to resend verification email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.1)] p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Citizen Login</h1>
          <p className="text-gray-600">Sign in to report and track crimes</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
            {/* Show resend link if error is about email verification */}
            {(error.includes("verify your email") || error.includes("Email not confirmed")) && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingEmail}
                className="mt-2 text-sm text-red-700 hover:text-red-800 underline disabled:no-underline disabled:opacity-50"
              >
                {resendingEmail ? "Sending..." : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="Enter your email"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="Enter your password"
              required
            />
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-[#237E54] hover:underline">
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#237E54] text-white py-3 rounded-lg font-semibold hover:bg-[#1a6644] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500">or</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#237E54] font-semibold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>

        {/* Admin/Police Login Link */}
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Are you an Admin or Police officer?{" "}
            <button
              onClick={() => navigate("/login", { state: { role: "Administrator" } })}
              className="text-gray-700 hover:underline"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
