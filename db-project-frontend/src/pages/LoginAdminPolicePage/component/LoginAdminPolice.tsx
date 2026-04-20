import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LogowithText from "../../../assets/LogowithText.svg";
import GreenButton from "../../../components/GreenButton";
import MainBackground from "../../../assets/MainBackground.png";
import PasswordSeeIcon from "../../../assets/PasswodSeeIcon.svg";
import PasswordHideIcon from "../../../assets/PasswodHideIcon.svg";
import BackButton from "../../../components/BackButton";
import { useDispatch } from "react-redux";
import { setRole } from "../../../store/features/current_role";
import { API_BASE_URL } from "../../../config/constants";

const LoginAdminPolice = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const verify_role = location.state.role;

  const NavigateLogin = () => {
    navigate("/login");
  };

  const NavigateDashboard = () => {
    navigate("/dashboard");
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    console.log("frontend");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, verify_role }),
      });
      console.log("hello");

      const data = await response.json();

      if (response.ok && data.success) {
        // Store token if needed
        localStorage.setItem("token", data.token);

        // 🔥🔥 SET ROLE IN REDUX GLOBAL STATE
        dispatch(setRole(data.user.role));

        // Navigate to dashboard
        NavigateDashboard();
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Server error. Try again later.");
    }
  };

  return (
    <div className="-m-4">
      <section
        className="flex items-center justify-center min-h-screen bg-cover bg-center p-4"
        style={{ backgroundImage: `url(${MainBackground})` }}
      >
        <div className="bg-white rounded-3xl shadow-xl flex flex-col px-4 sm:px-8 py-6 sm:py-8 w-full max-w-md space-y-4 md:space-y-6 mx-8 sm:mx-0">
          <div className="flex items-center text-[#145332] cursor-pointer text-sm">
            <div className="flex items-start" onClick={NavigateLogin}>
              <BackButton textSize="text-sm" iconSize={16} />
            </div>
          </div>

          <div className="flex items-center flex-col md:space-y-6">
            <div className="flex justify-center ">
              <img
                src={LogowithText}
                alt="CrimeLens"
                className="w-44 md:w-52"
              />
            </div>

            <h2 className="text-center font-outfit font-medium text-[#145332] text-md">
              Login as an {location.state.role}
            </h2>
          </div>

          <form
            className="flex flex-col w-full space-y-4"
            onSubmit={handleSubmit}
          >
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-2 border-[#d9d9d9] text-[#ababab] rounded-lg px-4 py-2 font-outfit text-sm focus:outline-none focus:border-[#237E54]"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <GreenButton type="submit" label="Login" />
          </form>
        </div>
      </section>
    </div>
  );
};

export default LoginAdminPolice;
