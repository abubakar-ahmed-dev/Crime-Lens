import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useSelector, useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import { setRole } from "../store/features/current_role";
import LogowithText from "../assets/LogowithText.svg";

const PageLayout = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { role, roleLoaded } = useSelector((state: any) => state.currentRole);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authMode = localStorage.getItem("authMode");
  const staffRole = localStorage.getItem("staffRole");
  const citizenActive =
    authMode === "citizen" &&
    localStorage.getItem("citizen") !== null &&
    localStorage.getItem("citizen_token") !== null;
  const storedRole =
    authMode === "staff"
      ? staffRole
      : citizenActive
        ? "user"
        : localStorage.getItem("userRole");
  const validStoredRole =
    storedRole === "admin" || storedRole === "police" || storedRole === "user"
      ? storedRole
      : null;
  const layoutRole = validStoredRole || role;
  const roleReady = !!layoutRole;
  const publicNavigationRoutes = ["/dashboard", "/statistics"];
  const isPublicNavigationRoute = publicNavigationRoutes.some((route) =>
    location.pathname.startsWith(route)
  );

  useEffect(() => {
    if (validStoredRole && (!roleLoaded || role !== validStoredRole)) {
      dispatch(setRole(validStoredRole));
    }
  }, [dispatch, role, roleLoaded, validStoredRole]);

  useEffect(() => {
    if (
      !validStoredRole &&
      !role &&
      !authMode &&
      isPublicNavigationRoute
    ) {
      dispatch(setRole("user"));
    }
  }, [authMode, dispatch, isPublicNavigationRoute, role, validStoredRole]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Routes where sidebar/header should NOT appear
  const hideOnRoutes = [
    "/",
    "/login",
    "/login-admin",
    "/login-citizen",
    "/register",
    "/map",
    "/request-agent",
    "/complete-profile",
  ];

  // Routes that should take full width (no padding)
  const fullBleedRoutes = ["/map"];

  // ✅ FIX: Use startsWith instead of includes
  const hideSidebar = hideOnRoutes.some((route) => {
    if (route === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(route);
  });

  const noPadding = fullBleedRoutes.some((route) =>
    location.pathname.startsWith(route)
  );

  const showNavigation = !hideSidebar && roleReady;

  return (
    <div className="flex w-full min-h-screen">
      {/* Header bar (mobile only) */}
      {showNavigation && (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-[999] h-14 flex items-center justify-between bg-[#fefefe] shadow-[0_0_5px_rgba(0,0,0,0.1)] px-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-1 rounded-lg text-[#237E54] hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
            <img src={LogowithText} alt="CrimeLens" className="h-8 w-auto" />
          </div>

          <div className="w-10" />
        </header>
      )}

      {/* Backdrop (mobile sidebar) */}
      {showNavigation && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-[1000] transition-opacity duration-200"
          style={{
            visibility: mobileMenuOpen ? "visible" : "hidden",
            opacity: mobileMenuOpen ? 1 : 0,
          }}
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileMenuOpen(false)}
          aria-hidden={!mobileMenuOpen}
        />
      )}

      {/* Sidebar */}
      {showNavigation && (
        <div
          className={`
            z-[1001] transition-transform duration-200 ease-out
            ${
              mobileMenuOpen
                ? "translate-x-0 fixed inset-y-0 left-0"
                : "fixed -translate-x-full inset-y-0 left-0"
            }
            lg:translate-x-0 lg:fixed lg:top-4 lg:left-4 lg:h-[calc(100vh-2rem)] lg:w-72
          `}
        >
          <Sidebar
            version={layoutRole}
            setPath={handleNavigation}
            onCloseMobile={() => setMobileMenuOpen(false)}
            isDrawer={mobileMenuOpen}
          />
        </div>
      )}

      {/* Main content */}
      <div
        className={`
          flex-1 min-w-0
          ${noPadding ? "" : showNavigation ? "pt-14 lg:pt-0 p-4" : "p-4"}
          ${showNavigation ? "lg:ml-72" : "lg:ml-0"}
        `}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default PageLayout;
