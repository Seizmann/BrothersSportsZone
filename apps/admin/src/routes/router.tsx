import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "../lib/auth";
import { ProtectedRoute } from "./protected";
import { Layout } from "./layout";
import { LoginPage } from "./login";
import { SiteSettingsPage } from "./site-settings";
import { PaymentsPage } from "./payments";
import { DashboardPage } from "./dashboard";
import { ExpensesPage } from "./expenses";
import { BookingsPage } from "./bookings";
import { MatchesPage } from "./matches";
import { MatchDetailPage } from "./match-detail";

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
      // Dashboard is the landing page; it self-renders a restriction notice
      // for stuff (§4.3 — no financial visibility for staff anywhere).
      {
        index: true,
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager"]}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "payments",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager", "stuff"]}>
            <PaymentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "bookings",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager", "stuff"]}>
            <BookingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "matches",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager", "stuff"]}>
            <MatchesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "matches/:matchId",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager", "stuff"]}>
            <MatchDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "expenses",
        element: (
          <ProtectedRoute requiredRoles={["sudo_admin", "manager"]}>
            <ExpensesPage />
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
