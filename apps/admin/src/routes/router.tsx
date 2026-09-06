import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AuthProvider } from "../lib/auth";
import { ProtectedRoute } from "./protected";
import { Layout } from "./layout";
import { LoginPage } from "./login";
import { SiteSettingsPage } from "./site-settings";
import { PaymentsPage } from "./payments";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/payments" replace /> },
      {
        path: "payments",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager", "stuff"]}>
            <PaymentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin"]}>
            <SiteSettingsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
