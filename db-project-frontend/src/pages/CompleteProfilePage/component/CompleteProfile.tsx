import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { citizen, updateCitizenProfile, citizenLogout, isCitizenAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    cnic: "",
    contact: "",
    address: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Redirect if not authenticated or profile is already complete
  useEffect(() => {
    // Check both state and localStorage for authentication
    const citizenFromStorage = localStorage.getItem("citizen");
    const isAuthenticated = isCitizenAuthenticated || !!citizenFromStorage;

    if (!isAuthenticated) {
      navigate("/login-citizen");
      return;
    }

    // Parse citizen data from state or storage
    const citizenData = citizen || (citizenFromStorage ? JSON.parse(citizenFromStorage) : null);

    if (citizenData?.isProfileComplete) {
      navigate("/citizen-dashboard");
      return;
    }

    // Pre-fill data if available
    if (citizenData?.cnic) setFormData((prev) => ({ ...prev, cnic: citizenData.cnic || "" }));
    if (citizenData?.contact) setFormData((prev) => ({ ...prev, contact: citizenData.contact || "" }));
    if (citizenData?.address) setFormData((prev) => ({ ...prev, address: citizenData.address || "" }));
  }, [citizen, isCitizenAuthenticated, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const formatCNIC = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");
    // Format as #####-#######-#
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  };

  const handleCnicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNIC(e.target.value);
    setFormData({ ...formData, cnic: formatted });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.cnic || !formData.contact || !formData.address) {
      setError("Please fill in all fields");
      return;
    }

    // CNIC validation: #####-#######-#
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(formData.cnic)) {
      setError("Invalid CNIC format. Use: #####-#######-#");
      return;
    }

    // Contact validation
    const phoneRegex = /^(\+92|0)?[3-9]\d{2}-?\d{7}$/;
    if (!phoneRegex.test(formData.contact.replace(/[- ]/g, ""))) {
      setError("Invalid contact number format");
      return;
    }

    setLoading(true);

    const result = await updateCitizenProfile(formData);

    setLoading(false);

    if (result.success) {
      // Redirect to dashboard
      navigate("/citizen-dashboard");
    } else {
      setError(result.message || "Profile update failed");
    }
  };

  const handleLogout = async () => {
    await citizenLogout();
    navigate("/login-citizen");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.1)] p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium mb-3">
            Step {step} of 1: Complete Your Profile
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Profile Completion</h1>
          <p className="text-gray-600">
            Welcome, {citizen?.fullName}! Please complete your profile to continue.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CNIC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CNIC Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="cnic"
              value={formData.cnic}
              onChange={handleCnicChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="#####-#######-#"
              maxLength={15}
              required
            />
            <p className="mt-1 text-xs text-gray-500">Format: 12345-1234567-1</p>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="+92-3XX-XXXXXXX or 03XX-XXXXXXX"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              placeholder="Enter your residential address"
              rows={3}
              required
            />
          </div>

          {/* Info Message */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-600 text-sm">
              <strong>Note:</strong> This information is required for crime reporting and verification purposes.
              Your data will be kept secure and confidential.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#237E54] text-white py-3 rounded-lg font-semibold hover:bg-[#1a6644] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Saving Profile..." : "Complete Profile"}
          </button>
        </form>

        {/* Logout Link */}
        <div className="mt-4 text-center">
          <button
            onClick={handleLogout}
            className="text-gray-500 text-sm hover:text-gray-700"
          >
            Logout and finish later
          </button>
        </div>
      </div>
    </div>
  );
}
