import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext.jsx";
import ErrorBoundary from "../shared/ui/ErrorBoundary.jsx";
import { router } from "./router.jsx";

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </AuthProvider>
  );
}
