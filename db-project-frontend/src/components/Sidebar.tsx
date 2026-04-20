import { useState, useEffect } from "react";
import LogowithText from "../assets/LogowithText.svg";
import GreenButton from "./GreenButton";
import { ICONS } from "../assets/icons";
import MeetCreatorsCard from "./MeetCreatorsCards";
import { useNavigate, useLocation } from "react-router-dom";

interface SidebarProps {
  version?: "admin" | "police" | "user";
  setPath?: (path: string) => void;
  onCloseMobile?: () => void;
  isDrawer?: boolean;
}

interface MenuItem {
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
}

const Sidebar = ({
  version,
  setPath,
  onCloseMobile,
  isDrawer,
}: SidebarProps) => {
  const asDrawer = isDrawer ?? !!onCloseMobile;
  const [activeItem, setActiveItem] = useState<string>("");
  const navigate = useNavigate();
  const location = useLocation();

  const allMenus: MenuItem[] = [
    { label: "Dashboard", icon: ICONS.DashboardIcon, activeIcon: ICONS.DashboardIcon_Active, route: "/dashboard" },
    { label: "Verify Agent", icon: ICONS.VerifyAgentIcon, activeIcon: ICONS.VerifyAgentIcon_Active, route: "/verification?type=admin" },
    { label: "Agent Records", icon: ICONS.AgentRecordsIcon, activeIcon: ICONS.AgentRecordsIcon_Active, route: "/all-records?type=admin" },
    { label: "Verify Report", icon: ICONS.VerifyReportIcon, activeIcon: ICONS.VerifyReportIcon_Active, route: "/verification?type=police" },
    { label: "Crime Records", icon: ICONS.CrimeRecordsIcon, activeIcon: ICONS.CrimeRecordsIcon_Active, route: "/all-records?type=police" },
    { label: "Report Crime", icon: ICONS.ReportCrimeIcon, activeIcon: ICONS.ReportCrimeIcon_Active, route: "/report-crime" },
    { label: "Upload Data", icon: ICONS.UploadDataIcon, activeIcon: ICONS.UploadDataIcon_Active, route: "/upload-crimes" },
    { label: "Give Feedback", icon: ICONS.GiveFeedbackIcon, activeIcon: ICONS.GiveFeedbackIcon_Active, route: "/feedback" },
  ];

  let filteredMenus: MenuItem[] = allMenus;

  if (version === "admin") {
    filteredMenus = allMenus.filter((m) =>
      ["Dashboard", "Verify Agent", "Agent Records", "Upload Data"].includes(m.label)
    );
  } else if (version === "police") {
    filteredMenus = allMenus.filter((m) =>
      ["Dashboard", "Verify Report", "Crime Records", "Upload Data"].includes(m.label)
    );
  } else if (version === "user") {
    filteredMenus = allMenus.filter((m) =>
      ["Dashboard", "Report Crime"].includes(m.label)
    );
  }

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const currentMenuItem = allMenus.find((menu) => menu.route === currentPath);
    if (currentMenuItem) setActiveItem(currentMenuItem.label);
  }, [location.pathname, location.search]);

  const buttonText =
    version === "admin" || version === "police" ? "Logout" : "Back to Home";

  return (
    <div
      className={`
        flex flex-col bg-[#fefefe] shadow-[0_0_5px_rgba(0,0,0,0.15)]
        ${asDrawer
          ? "h-full w-[min(320px,85vw)] rounded-none"
          : "lg:fixed lg:top-4 lg:left-4 lg:h-[calc(100vh-2rem)] lg:w-72 rounded-2xl"}
        py-4 px-4 overflow-hidden
      `}
    >
      {/* Close button (mobile only) */}
      {asDrawer && onCloseMobile && (
        <div className="flex justify-end pr-3 pt-3 pb-1">
          <button onClick={onCloseMobile} className="p-2 rounded-lg hover:bg-gray-100">
            ✕
          </button>
        </div>
      )}

      {/* Top Section */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2">
          <img src={LogowithText} alt="CrimeLens Logo" className="h-8 lg:h-10" />
        </div>

        <p className="text-xs text-gray-400 font-medium mt-4 mb-4 px-2">
          MENU
        </p>

        {/* Menu */}
        <nav className="flex flex-col gap-3 overflow-y-auto pr-1">
          {filteredMenus.map((item) => (
            <button
              key={item.label}
              onClick={() => setPath?.(item.route)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${
                activeItem === item.label
                  ? "bg-green-50 text-black font-medium"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <img
                src={activeItem === item.label ? item.activeIcon : item.icon}
                className="w-5 h-5"
              />
              <span className="truncate">{item.label}</span>

              {activeItem === item.label && (
                <div className="ml-auto h-5 w-1 bg-[#237E54] rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Divider */}
        <hr className="border-t-2 border-[#d9d9d9] mt-6 mb-6 mx-2" />

        {/* Button */}
        <div className="flex justify-center">
          <GreenButton
            label={buttonText}
            width={220}
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/");
            }}
          />
        </div>
      </div>

      {/* Bottom Card */}
      <div className="mt-auto pt-4 flex justify-center">
        <div className="w-full max-w-[260px]">
          <MeetCreatorsCard />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;