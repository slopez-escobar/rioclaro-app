import { useLayoutEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { can, landingPath } from "./permissions.js";

/** Sin props: exige sesión. Con `modulo` y `accion`: exige además ese permiso. */
export default function ProtectedRoute({ modulo, accion = "ver" }) {
  const { session, refreshSession } = useAuth();
  const location = useLocation();
  useLayoutEffect(() => {
    refreshSession();
  }, [location.pathname, location.search, location.hash, refreshSession]);
  if (!session) return <Navigate to="/login" replace />;
  if (modulo && !can(session.rol, modulo, accion)) return <Navigate to={landingPath(session.rol)} replace />;
  return <Outlet />;
}
