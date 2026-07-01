import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { CitizenProtectedRoutes, PublicRoutes, ProtectedRoutes } from "./routes/index";
import PageLayout from "./layouts/page-layouts";

const useAuth = () => {
  const isAuthenticated = localStorage.getItem("token") !== null;
  return { isAuthenticated };
};

const useCitizenAuth = () => {
  const isCitizenAuthenticated =
    localStorage.getItem("citizen") !== null &&
    localStorage.getItem("citizen_token") !== null;
  return { isCitizenAuthenticated };
};

const ProtectedRoute = ({
  children,
  allowedRoles = [],
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { isAuthenticated } = useAuth();
  const role = localStorage.getItem("userRole");

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const CitizenProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isCitizenAuthenticated } = useCitizenAuth();

  if (!isCitizenAuthenticated) {
    return <Navigate to="/login-citizen" replace />;
  }

  return <>{children}</>;
};

const AuthCallbackRedirect = () => {
  useEffect(() => {
    const isCallbackRoute = window.location.pathname === "/auth/callback";
    const hasAuthHash = window.location.hash.includes("access_token");
    const hasAuthCode = new URLSearchParams(window.location.search).has("code");

    if (!isCallbackRoute && (hasAuthHash || hasAuthCode)) {
      window.location.replace(
        `${window.location.origin}/auth/callback${window.location.search}${window.location.hash}`
      );
    }
  }, []);

  return null;
};

function App() {
  const publicRoutes = PublicRoutes();
  const protectedRoutes = ProtectedRoutes();
  const citizenProtectedRoutes = CitizenProtectedRoutes();

  return (
    <BrowserRouter>
      <AuthCallbackRedirect />
      <Routes>
        {/* PUBLIC ROUTES (No Layout) */}
        <Route element={<PageLayout />}>

        {publicRoutes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}
        </Route>

        {/* PROTECTED ROUTES (With Layout + Sidebar) */}
        {protectedRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <ProtectedRoute allowedRoles={route.allowedRoles}>
                <PageLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={route.element} />
          </Route>
        ))}

        {/* CITIZEN PROTECTED ROUTES */}
        {citizenProtectedRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <CitizenProtectedRoute>
                <PageLayout />
              </CitizenProtectedRoute>
            }
          >
            <Route index element={route.element} />
          </Route>
        ))}

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
