import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import LogowithText from "../../../assets/LogowithText.svg";
import MainBackground from "../../../assets/MainBackground.png";
import InstructionIcon from "../../../assets/InstructionIcon.svg";
import BackButton from "../../../components/BackButton";
import GreenButton from "../../../components/GreenButton";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { citizen, updateCitizenProfile, citizenLogout, isCitizenAuthenticated, resendVerificationEmail } = useAuth();

  const [formData, setFormData] = useState({
    cnic: "",
    contact: "",
    address: "",
  });

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Redirect if not authenticated or profile is already complete
  useEffect(() => {
    // Check both state and localStorage for authentication
    const citizenFromStorage = localStorage.getItem("citizen");
    const isAuthenticated = isCitizenAuthenticated || !!citizenFromStorage;

    if (!isAuthenticated) {
      navigate("/login-citizen");
      return;
    }

    // Parse citizen data from state or storage (safely handle "undefined" string)
    let citizenData = citizen;
    if (!citizenData && citizenFromStorage && citizenFromStorage !== "undefined") {
      try {
        citizenData = JSON.parse(citizenFromStorage);
      } catch (e) {
        console.error("Failed to parse citizen data from storage:", e);
        citizenData = null;
      }
    }

    if (citizenData?.isProfileComplete) {
      navigate("/citizen-dashboard");
      return;
    }

    // Pre-fill data if available
    if (citizenData?.cnic) setFormData((prev) => ({ ...prev, cnic: citizenData.cnic || "" }));
    if (citizenData?.contact) setFormData((prev) => ({ ...prev, contact: citizenData.contact || "" }));
    if (citizenData?.address) setFormData((prev) => ({ ...prev, address: citizenData.address || "" }));
  }, [citizen, isCitizenAuthenticated, navigate]);

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

  const formatContact = (value: string) => {
    let digits = value.replace(/\D/g, "");

    if (digits.startsWith("92")) {
      digits = digits.slice(2);
    }

    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }

    digits = digits.slice(0, 10);

    if (!digits) return "";
    if (digits.length <= 3) return `+92-${digits}`;
    return `+92-${digits.slice(0, 3)}-${digits.slice(3)}`;
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatContact(e.target.value);
    setFormData({ ...formData, contact: formatted });
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
    const phoneRegex = /^\+92-[3-9]\d{2}-\d{7}$/;
    if (!phoneRegex.test(formData.contact)) {
      setError("Invalid contact number format. Use: +92-3XX-XXXXXXX");
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

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setError("");
    setSuccessMessage("");

    const result = await resendVerificationEmail();

    setResendingEmail(false);

    if (result.success) {
      setSuccessMessage(result.message || "Verification email sent!");
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(""), 5000);
    } else {
      setError(result.message || "Failed to resend verification email");
    }
  };

  // Check if email is not verified (only for email signup, not Google/OAuth)
  const isEmailNotVerified = citizen?.provider === "email" && !citizen?.emailVerified;

  return (
    <div className="-m-4">
      <section
        className="flex items-center justify-center min-h-screen bg-cover bg-center p-4"
        style={{ backgroundImage: `url(${MainBackground})` }}
      >
        <div className="bg-white rounded-3xl shadow-xl flex flex-col px-4 sm:px-8 py-6 sm:py-8 w-full max-w-md space-y-4 md:space-y-6 mx-8 sm:mx-0">
          <div className="flex items-center text-[#145332] cursor-pointer text-sm">
            <div className="flex items-start" onClick={handleLogout}>
              <BackButton textSize="text-sm" iconSize={16} />
            </div>
          </div>

          <div className="flex items-center flex-col md:space-y-6">
            <div className="flex justify-center">
              <img src={LogowithText} alt="CrimeLens" className="w-44 md:w-52" />
            </div>

            <h2 className="text-center font-outfit font-medium text-[#145332] text-md">
              Complete Citizen Profile
            </h2>
          </div>

          {isEmailNotVerified && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
              <p className="text-yellow-700 text-sm font-outfit">
                Please verify your email before completing your profile.
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={resendingEmail}
                  className="ml-2 underline font-medium disabled:no-underline disabled:opacity-50"
                >
                  {resendingEmail ? "Sending..." : "Resend verification email"}
                </button>
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm font-outfit">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-600 text-sm font-outfit">{successMessage}</p>
            </div>
          )}


          <div className="flex items-center gap-3 border-2 border-[#00A6FB] bg-[#F1F9FF] rounded-lg p-3">
            <img
              src={InstructionIcon}
              alt="Info"
              className="w-7 h-7 shrink-0 self-center"
            />
            <p className="text-sm text-[#00A6FB] font-outfit font-medium leading-snug">
              Complete your profile to continue with citizen crime reporting.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col w-full space-y-4">


            <input
              type="text"
              name="cnic"
              value={formData.cnic}
              onChange={handleCnicChange}
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
              placeholder="CNIC Number"
              maxLength={15}
              required
            />

            <input
              type="text"
              name="contact"
              value={formData.contact}
              onChange={handleContactChange}
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
              placeholder="Contact Number"
              maxLength={15}
              required
            />

            <textarea
              name="address"
              value={formData.address}
              onChange={(e) => {
                setFormData({ ...formData, address: e.target.value });
                setError("");
              }}
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54] resize-none mb-7"
              placeholder="Residential Address"
              rows={3}
              required
            />


            <GreenButton
              type="submit"
              label={loading ? "Saving Profile..." : "Complete Profile"}
              fullWidth
              disabled={loading}
            />
          </form>
        </div>
      </section>
    </div>
  );
}
