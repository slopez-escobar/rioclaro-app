import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTE_ACCESS } from "./routeAccess.js";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { landingPath } from "../features/auth/permissions.js";
import ProtectedRoute from "../features/auth/ProtectedRoute.jsx";
import LoginPage from "../features/auth/LoginPage.jsx";
import { ErrorFallback } from "../shared/ui/ErrorBoundary.jsx";

const pages = {
  "/ia-responsable": lazy(() => import("../features/responsible-ai/ResponsibleAiPage.jsx")),
  "/panel": lazy(() => import("../features/dashboard/DashboardPage.jsx")),
  "/admin": lazy(() => import("../features/admin/AdminPage.jsx")),
  "/politicas": lazy(() => import("../features/policies/PoliciesPage.jsx")),
  "/asistente": lazy(() => import("../features/chat/ChatPage.jsx")),
  "/facturas": lazy(() => import("../features/invoices/InvoicesPage.jsx")),
  "/pedidos": lazy(() => import("../features/orders/OrdersPage.jsx")),
  "/ventas": lazy(() => import("../features/sales/SalesPage.jsx")),
  "/quejas": lazy(() => import("../features/complaints/ComplaintsPage.jsx")),
  "/existencias": lazy(() => import("../features/inventory/InventoryPage.jsx")),
  "/catalogo": lazy(() => import("../features/catalog/CatalogPage.jsx")),
};

function Inicio() {
  const { session } = useAuth();
  return <Navigate to={session ? landingPath(session.rol) : "/login"} replace />;
}

function buildPageRoute(definition) {
  const Page = pages[definition.path];
  const pageRoute = {
    path: definition.path,
    errorElement: <ErrorFallback />,
    element: (
      <Suspense fallback={<p className="route-loading" role="status">Cargando…</p>}>
        <Page />
      </Suspense>
    ),
  };
  if (!definition.module) return pageRoute;
  return {
    element: (
      <ProtectedRoute
        modulo={definition.module}
        accion={definition.action || "ver"}
      />
    ),
    errorElement: <ErrorFallback />,
    children: [pageRoute],
  };
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <ErrorFallback /> },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorFallback />,
    children: ROUTE_ACCESS
      .filter(({ path }) => !["/login", "/", "*"].includes(path))
      .map(buildPageRoute),
  },
  { path: "/", element: <Inicio />, errorElement: <ErrorFallback /> },
  { path: "*", element: <Inicio />, errorElement: <ErrorFallback /> },
]);
