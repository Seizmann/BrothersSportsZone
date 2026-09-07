import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import type { StaffRole } from "@brotherssportszone/shared";

// Nav visibility mirrors the route guards: / and /expenses sudo_admin+manager,
// /payments and /bookings all staff, /settings sudo_admin only. RLS remains
// the real enforcement.
const NAV_ITEMS: { to: string; label: string; roles: readonly StaffRole[] }[] = [
  { to: "/", label: "Dashboard", roles: ["sudo_admin", "manager"] },
  { to: "/bookings", label: "Bookings", roles: ["sudo_admin", "manager", "stuff"] },
  { to: "/payments", label: "Payments", roles: ["sudo_admin", "manager", "stuff"] },
  { to: "/matches", label: "Matches", roles: ["sudo_admin", "manager", "stuff"] },
  { to: "/expenses", label: "Expenses", roles: ["sudo_admin", "manager"] },
  { to: "/settings", label: "Site settings", roles: ["sudo_admin"] },
];

export function Layout() {
  const { role } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-green-950 bg-green-900 text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">BSZ Admin</span>
          <nav className="flex flex-1 gap-4">
            {NAV_ITEMS.filter((item) => role && item.roles.includes(role)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm ${isActive ? "font-semibold text-white" : "text-green-100 hover:text-white"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={handleLogout} className="text-sm text-green-200 hover:text-white">
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
