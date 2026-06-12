import UploadPage from "../pages/UploadPage";
import AddPolicePage from "../pages/AddPolicePage";
import AllRecordsPage from "../pages/AllRecordsPage";
import DashboardPage from "../pages/DashboardPage";
import HomePage from "../pages/HomePage";
import LoginAdminPage from "../pages/LoginAdminPolicePage";
import LoginPage from "../pages/LoginPage";
import VerificationPage from "../pages/VerificationPage";
import MapViewPage from "../pages/MapViewPage";
import MeetDevelopersPage from "../pages/MeetDevelopersPage";
import StatisticsPage from "../pages/StatisticsPage";
import ReportCrimePage from "../pages/ReportCrimePage";
import RegisterPage from "../pages/RegisterPage";
import CitizenLoginPage from "../pages/CitizenLoginPage";
import CompleteProfilePage from "../pages/CompleteProfilePage";
import CitizenDashboardPage from "../pages/CitizenDashboardPage";
import AuthCallbackPage from "../pages/AuthCallback/AuthCallback";

type TRoute = {
  path: string;
  element: React.ReactNode;
};

export const PublicRoutes = () => {
  const routes: TRoute[] = [
    {
      path: "/",
      element: <HomePage />,
    },
    {
        path: "/login",
        element: <LoginPage/>
    },
    {
        path: "/login-admin",
        element: <LoginAdminPage/>
    },
    {
      path: "/login-citizen",
      element: <CitizenLoginPage/>
    },
    {
      path: "/register",
      element: <RegisterPage/>
    },
    {
      path: "/complete-profile",
      element: <CompleteProfilePage/>
    },
    {
      path: "/citizen-dashboard",
      element: <CitizenDashboardPage/>
    },
    {
        path: "/request-agent",
        element: <AddPolicePage/>
    },
    {
        path: "/dashboard",
        element: <DashboardPage/>
    },
    {
        path: "/statistics",
        element: <StatisticsPage/>
    },
    {
        path: "/map",
        element: <MapViewPage/>
    },
    {
        path: "/meet-developers",
        element: <MeetDevelopersPage/>
    },
    {
        path: "/report-crime",
        element: <ReportCrimePage/>
    },
    {
        path: "/auth/callback",
        element: <AuthCallbackPage/>
    },

  ];

  return routes;
};

export const ProtectedRoutes = () => {
    const routes: TRoute[] = [
      {
        path: "/all-records",
        element: <AllRecordsPage/>,
      },
      {
          path: "/verification",
          element: <VerificationPage/>
      },
      {
        path: "/upload-crimes",
        element: <UploadPage/>
      }
  
    ];
  
    return routes;
  };
