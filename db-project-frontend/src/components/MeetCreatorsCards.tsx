import WhiteLogo from "../assets/LogowithoutText-White.svg";
import WhiteButton from "./WhiteButton";
import MainBackground from "../assets/MainBackground.png";
import { useNavigate } from "react-router-dom";

type MeetCreatorsCardProps = {
  width?: string;
  height?: string;
  showLogo?: boolean;
};

const MeetCreatorsCard = ({ width = "w-full max-w-[260px]", height = "h-40", showLogo = true }: MeetCreatorsCardProps) => {
  const navigate = useNavigate();

  const NavigateMeetCreators = () => {
    navigate("/meet-developers");
  };

  return (
    <div
      className={`relative ${width} rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.15)]`}
      style={{
        backgroundImage: `url(${MainBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/25 to-transparent rounded-2xl"></div>

      {/* Content */}
      <div className={`relative z-10 flex h-full flex-col p-4 ${height} text-white`}>
        {showLogo && <img src={WhiteLogo} alt="Logo" className="w-6 h-6 ml-1 mb-2" />}

        <div className="ml-1">
          <h2 className="text-sm font-medium leading-tight">Meet the</h2>
          <h3 className="text-2xl font-semibold leading-tight">Creators</h3>
          <p className="text-xs mt-1 text-[#ffffff]">Know more about us.</p>
        </div>

        <div className="mt-auto pt-3">
          <WhiteButton label="See Now" width={207} fullWidth height={36} onClick={NavigateMeetCreators} />
        </div>
      </div>
    </div>
  );
};

export default MeetCreatorsCard;