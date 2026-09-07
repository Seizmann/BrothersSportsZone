import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { STAFF_ROLES, type StaffRole } from "@brotherssportszone/shared";
import type { ReactNode } from "react";

// Route guard for the SPA. requiredRoles is the UI-level gate; the database
// RLS remains the real enforcement (a forged role would just surface errors).
export function ProtectedRoute({
  requiredRoles,
  children,
}: {
  requiredRoles?: readonly StaffRole[];
  children: ReactNode;
}) {
  const { session, role, loading, notStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-neutral-500">Loading…</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (notStaff || !role) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-red-700">Not authorized</h1>
        <p className="mt-2 text-neutral-600">
          This account does not have staff access. Contact a Super Admin.
        </p>
      </div>
    );
  }

  if (requiredRoles && !requiredRoles.includes(role)) {
    return (
      <div className="p-8">
        <h1 className="text-lg font-semibold text-red-700">Forbidden</h1>
        <p className="mt-2 text-neutral-600">
          Your role ({role}) cannot access this page. Required:{" "}
          {requiredRoles.join(" or ")}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export const ALL_STAFF_ROLES = STAFF_ROLES;
