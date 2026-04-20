import { useNavigate } from "react-router-dom";
import LogowithText from "../../../assets/LogowithText.svg";
import MainBackground from "../../../assets/MainBackground.png";
import GreenButton from "../../../components/GreenButton";
import WhiteButton from "../../../components/WhiteButton";

const Home = () => {
  const navigate = useNavigate();

  const NavigateLogin = () => {
    navigate("/login");
  };

  const NavigateDashboard = () => {
    navigate("/dashboard");
  };

  const NavigateMeetCreators = () => {
    navigate("/meet-developers");
  };

  return (
    <section className="flex flex-col md:flex-row items-center justify-even min-h-screen bg-white">
      {/* Left Section */}
      <div className="flex flex-col justify-center px-4 sm:px-8 md:px-20 py-8 sm:py-10 w-full md:w-1/2 space-y-4 sm:space-y-6">
        <img
          src={LogowithText}
          alt="CrimeLens Logo"
          className="w-44 md:w-56 mb-6"
        />

        <div className="space-y-2 pt-8">
          <h1 className="text-4xl md:text-5xl font-outfit font-bold bg-linear-to-r from-[#145332] to-[#237E54] bg-clip-text text-transparent">
            Stay Informed.
          </h1>
          <h2 className="text-4xl md:text-5xl font-outfit font-bold bg-linear-to-r from-[#145332] to-[#237E54] bg-clip-text text-transparent">
            See Crime Clearly.
          </h2>
          <h3 className="text-4xl md:text-5xl font-outfit font-bold bg-linear-to-r from-[#145332] to-[#237E54] bg-clip-text text-transparent">
            Stay One Step Ahead.
          </h3>

          <p className="text-gray-800 text-sm md:text-base font-outfit font-medium leading-relaxed max-w-md pt-8">
            CrimeLens provides real-time crime analytics and insights across
            your city. Explore interactive maps, live statistics, and verified
            police reports to stay informed, aware, and proactive. Track ongoing
            incidents, understand local safety trends, and make smarter
            decisions — all in one dynamic dashboard.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-8 sm:pt-12 w-full sm:w-auto">
          <GreenButton
            label="Proceed as a Public User"
            width={350}
            fullWidth
            onClick={NavigateDashboard}
          />
          <div className="w-full sm:w-auto">
            <WhiteButton
              label="Login"
              width={100}
              fullWidth
              onClick={NavigateLogin}
            />
          </div>
        </div>
      </div>

      {/* Right Section */}
      {/* Meet Creators Card - Mobile only */}
      <div className="w-full flex items-center justify-center px-4 md:hidden">
        <div
          className={`relative w-full rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.15)]`}
          style={{
            backgroundImage: `url(${MainBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/25 to-transparent rounded-2xl"></div>

          {/* Content */}
          <div
            className={`relative z-10 flex flex-col justify-between p-4 h-50 gap-y-1 text-white`}
          >
            <div className="ml-1 flex flex-col mt-8 items-center">
              <h2 className="text-sm font-medium leading-tight">Meet the</h2>
              <h3 className="text-2xl font-semibold leading-tight">Creators</h3>
              <p className="text-xs mt-1 text-[#ffffff]">Know more about us.</p>
            </div>

            <div>
              <WhiteButton
                label="See Now"
                fullWidth
                height={36}
                onClick={NavigateMeetCreators}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Desktop only */}
      <div
        className="hidden md:flex w-full md:w-1/2 h-[650px] overflow-hidden items-end justify-center pb-8 px-8 rounded-3xl"
        style={{
          backgroundImage: `url(${MainBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <WhiteButton
          label="Meet the Creators"
          width={100}
          height={45}
          fullWidth
          onClick={NavigateMeetCreators}
        />
      </div>
    </section>
  );
};

export default Home;
