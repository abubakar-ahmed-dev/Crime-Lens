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

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");

    if (
      storedRole &&
      (storedRole === "admin" ||
        storedRole === "police" ||
        storedRole === "user")
    ) {
      if (!roleLoaded) {
        dispatch(setRole(storedRole));
      }
    }
  }, [dispatch, roleLoaded]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Routes where sidebar/header should NOT appear
  const hideOnRoutes = [
    "/",
    "/login",
    "/login-admin",
    "/map",
    "/request-agent",
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

  const showHeaderBar = !hideSidebar && roleLoaded;

  return (
    <div className="flex w-full min-h-screen">
      {/* Header bar (mobile only) */}
      {showHeaderBar && (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-999 h-14 flex items-center justify-between bg-[#fefefe] shadow-[0_0_5px_rgba(0,0,0,0.1)] px-4">
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
      {showHeaderBar && (
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
      {!hideSidebar && roleLoaded && (
        <div
          className={`
            z-1001 transition-transform duration-200 ease-out
            ${
              mobileMenuOpen
                ? "translate-x-0 fixed inset-y-0 left-0"
                : "fixed -translate-x-full inset-y-0 left-0"
            }
            lg:translate-x-0 lg:fixed lg:top-0 lg:left-0 lg:h-screen lg:w-72
          `}
        >
          <Sidebar
            version={role}
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
          ${noPadding ? "" : showHeaderBar ? "pt-14 lg:pt-0 p-4" : "p-4"}
          ${hideSidebar ? "lg:ml-0" : "lg:ml-72"}
        `}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default PageLayout;