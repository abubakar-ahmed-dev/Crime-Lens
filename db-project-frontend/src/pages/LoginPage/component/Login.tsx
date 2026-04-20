import LogowithText from "../../../assets/LogowithText.svg";
import GreenButton from "../../../components/GreenButton";
import WhiteButton from "../../../components/WhiteButton";
import MainBackground from "../../../assets/MainBackground.png";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();

  const NavigateCreateNewAgent = () => {
    navigate("/request-agent");
  };

  const NavigateLoginAdmin = (role: string) => {
    navigate("/login-admin", { state: { role } });
  };

  const NavigateHome = () => {
    navigate("/");
  };

  return (
    <div className="-m-4">
      <section
        className="flex items-center justify-center min-h-screen bg-cover bg-center"
        style={{
          backgroundImage: `url(${MainBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* White Card Container */}
        <div className="bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center px-4 sm:px-8 py-6 sm:py-8 w-full max-w-md space-y-5 sm:space-y-6 md:space-y-8 mx-8 sm:mx-0">
          {/* Logo */}
          <img
            src={LogowithText}
            alt="CrimeLens"
            className="w-36 sm:w-40 md:w-48 mb-6 sm:mb-8"
          />

          {/* White Outline Buttons */}
          <div className="flex flex-col w-full space-y-4 gap-y-4">
            <WhiteButton
              label="Create a new Police Agent"
              onClick={NavigateCreateNewAgent}
            />
            <hr className="border-t-2 border-[#d9d9d9] mx-4" />
            <WhiteButton
              label="Login as an Administrator"
              onClick={() => NavigateLoginAdmin("Administrator")}
            />
            <WhiteButton
              label="Login as a Police Agent"
              onClick={() => NavigateLoginAdmin("Police Agent")}
            />
            <hr className="border-t-2 border-[#d9d9d9] mx-4" />
            <GreenButton label="Back to Home" onClick={NavigateHome} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
