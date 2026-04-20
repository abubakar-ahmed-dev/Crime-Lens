import { useState } from "react";
import LogowithText from "../../../assets/LogowithText.svg";
import MainBackground from "../../../assets/MainBackground.png";
import PasswordSeeIcon from "../../../assets/PasswodSeeIcon.svg";
import PasswordHideIcon from "../../../assets/PasswodHideIcon.svg";
import InstructionIcon from "../../../assets/InstructionIcon.svg";
import { useNavigate } from "react-router-dom";
import BackButton from "../../../components/BackButton";
import { API_BASE_URL } from "../../../config/constants";

const LoginCreate = () => {
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    branchId: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const NavigateHome = () => {
    navigate("/");
  };

  const NavigateLogin = () => {
    navigate("/login");
  };

  // Handle input changes
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    // Validation
    if (!formData.branchId || !formData.username || !formData.password) {
      setError("All fields are required");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      console.log("Submitting agent request...", formData);

      const response = await fetch(`${API_BASE_URL}/agent/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: formData.branchId,
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();
      console.log("Backend Response:", data);

      if (response.ok && data.success) {
        setSuccessMsg(
          "Agent request submitted successfully! Awaiting verification."
        );

        // Reset form
        setFormData({
          branchId: "",
          username: "",
          password: "",
          confirmPassword: "",
        });

        // Navigate after 2 seconds
        setTimeout(() => {
          NavigateHome();
        }, 2000);
      } else {
        setError(data.message || "Failed to submit the request");
      }
    } catch (err) {
      console.error("Error submitting request:", err);
      setError("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="-m-4">
      <section
        className="flex items-center justify-center min-h-screen bg-cover bg-center p-4"
        style={{ backgroundImage: `url(${MainBackground})` }}
      >
        {/* White Card */}
        <div className="bg-white rounded-3xl shadow-xl flex flex-col px-4 sm:px-8 py-6 sm:py-8 w-full max-w-md space-y-4 md:space-y-6 mx-8 sm:mx-0">
          {/* Back Arrow */}
          <div className="flex items-center text-[#145332] cursor-pointer text-sm">
            <div className="flex items-start" onClick={NavigateLogin}>
              <BackButton textSize="text-sm" iconSize={16} />
            </div>
          </div>

          <div className="flex items-center flex-col md:space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <img
                src={LogowithText}
                alt="CrimeLens"
                className="w-44 md:w-52"
              />
            </div>

            {/* Title */}
            <h2 className="text-center font-outfit font-medium text-[#145332] text-md">
              Creating a new Police Agent
            </h2>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm font-outfit">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-600 text-sm font-outfit">{successMsg}</p>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col w-full space-y-4"
          >
            {/* Branch ID */}
            <input
              type="text"
              name="branchId"
              placeholder="Branch ID"
              value={formData.branchId}
              onChange={handleChange}
              required
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
            />

            {/* Username */}
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
            />

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
                className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 w-full font-outfit text-sm focus:outline-none focus:border-[#237E54]"
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2 text-gray-400 cursor-pointer"
              >
                <img
                  src={showPassword ? PasswordHideIcon : PasswordSeeIcon}
                  alt="toggle password visibility"
                />
              </span>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 w-full font-outfit text-sm focus:outline-none focus:border-[#237E54]"
              />
              <span
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2 text-gray-400 cursor-pointer"
              >
                <img
                  src={showConfirm ? PasswordHideIcon : PasswordSeeIcon}
                  alt="toggle confirm password visibility"
                />
              </span>
            </div>

            {/* Info Box */}
            <div className="flex items-center gap-3 border-2 border-[#00A6FB] bg-[#F1F9FF] rounded-lg p-3">
              <img
                src={InstructionIcon}
                alt="Info"
                className="w-7 h-7 shrink-0 self-center"
              />
              <p className="text-sm text-[#00A6FB] font-outfit font-medium leading-snug">
                Submit request and then wait for manual verification call to
                finalize creation of a new agent for your branch.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-linear-to-r from-[#145332] to-[#237E54] border-2 border-[#237E54] hover:from-[#145332] hover:to-[#145332] disabled:bg-gray-400 text-white text-sm rounded-full font-normal transition-colors"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default LoginCreate;
