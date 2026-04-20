import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PublicRoutes, ProtectedRoutes } from "./routes/index";
import PageLayout from "./layouts/page-layouts";

const useAuth = () => {
  const isAuthenticated = localStorage.getItem("token") !== null;
  return { isAuthenticated };
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
        <Route element={<ProtectedRoute><PageLayout /></ProtectedRoute>}>
          {protectedRoutes.map((route) => (
            <Route 
              key={route.path} 
              path={route.path} 
              element={route.element} 
            />
          ))}
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
