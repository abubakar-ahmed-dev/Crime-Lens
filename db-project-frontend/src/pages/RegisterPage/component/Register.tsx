import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import LogowithText from "../../../assets/LogowithText.svg";
import GreenButton from "../../../components/GreenButton";
import MainBackground from "../../../assets/MainBackground.png";
import PasswordSeeIcon from "../../../assets/PasswodSeeIcon.svg";
import PasswordHideIcon from "../../../assets/PasswodHideIcon.svg";
import BackButton from "../../../components/BackButton";

export default function Register() {
  const navigate = useNavigate();
  const { citizenRegister, citizenGoogleLogin } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const NavigateLogin = () => {
    navigate("/login");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "fullName") setFullName(value);
    if (name === "email") setEmail(value);
    if (name === "password") setPassword(value);
    if (name === "confirmPassword") setConfirmPassword(value);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    // Validation
    if (!fullName || !email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const result = await citizenRegister(email, password, fullName);

    setLoading(false);

    if (result.success) {
      if (result.requiresEmailVerification) {
        setSuccessMessage("Registration successful! Please check your email to verify your account.");
      } else {
        navigate("/complete-profile");
      }
    } else {
      setError(result.message || "Registration failed");
    }
  };

  const handleGoogleLogin = async () => {
    const result = await citizenGoogleLogin("signup");
    if (!result.success) {
      setError(result.message || "Google login failed");
    }
    // Supabase will handle redirect
  };

  return (
    <div className="-m-4">
      <section
        className="flex items-center justify-center min-h-screen bg-cover bg-center p-4"
        style={{ backgroundImage: `url(${MainBackground})` }}
      >
        <div className="bg-white rounded-3xl shadow-xl flex flex-col px-4 sm:px-8 py-6 sm:py-8 w-full max-w-md space-y-4 md:space-y-6 mx-8 sm:mx-0">
          {/* Back Button */}
          <div className="flex items-center text-[#145332] cursor-pointer text-sm">
            <div className="flex items-start" onClick={NavigateLogin}>
              <BackButton textSize="text-sm" iconSize={16} />
            </div>
          </div>

          {/* Logo and Header */}
          <div className="flex items-center flex-col md:space-y-6 -mt-3">
            <div className="flex justify-center">
              <img src={LogowithText} alt="CrimeLens" className="w-44 md:w-52" />
            </div>
            <h2 className="text-center font-outfit font-medium text-[#145332] text-md">
              Citizen Registration
            </h2>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-500 rounded-lg p-3">
              <p className="text-green-700 text-sm">{successMessage}</p>
            </div>
          )}

          <form className="flex flex-col w-full space-y-4" onSubmit={handleSubmit}>
            <input
              type="text"
              name="fullName"
              placeholder="Full Name"
              value={fullName}
              onChange={handleChange}
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={handleChange}
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={password}
                onChange={handleChange}
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

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={handleChange}
                className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 w-full font-outfit text-sm focus:outline-none focus:border-[#237E54]"
              />
              <span
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2 text-gray-400 cursor-pointer"
              >
                <img
                  src={showConfirmPassword ? PasswordHideIcon : PasswordSeeIcon}
                  alt="toggle password visibility"
                />
              </span>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <GreenButton
              type="submit"
              label={loading ? "Creating Account..." : "Create Account"}
              fullWidth
            />
          </form>

          {/* Divider */}
          <div className="flex items-center mb-4 -mt-2">
            <div className="flex-1 border-t border-[#d9d9d9]"></div>
            <span className="px-4 text-sm text-[#ababab]">or</span>
            <div className="flex-1 border-t border-[#d9d9d9]"></div>
          </div>

          {/* Google Sign Up Button */}
          <button
            onClick={handleGoogleLogin}
            className="bg-[#ffffff] rounded-4xl border-2 border-[#237E54] font-outfit font-medium py-2 px-5 items-center text-[#237E54] text-sm hover:bg-[#ebedec] cursor-pointer w-full flex items-center justify-center"
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
            Sign Up with Google
          </button>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-[#ababab] text-sm">
              Already have an account?{" "}
              <Link to="/login-citizen" className="text-[#237E54] font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
