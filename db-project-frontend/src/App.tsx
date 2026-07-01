import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PublicRoutes, ProtectedRoutes } from "./routes/index";
import PageLayout from "./layouts/page-layouts";

const useAuth = () => {
  const isAuthenticated = localStorage.getItem("token") !== null;
  return { isAuthenticated };
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

function App() {
  const publicRoutes = PublicRoutes();
  const protectedRoutes = ProtectedRoutes();

  return (
    <BrowserRouter>
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

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
