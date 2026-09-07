import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { StaffRole } from "@brotherssportszone/shared";

interface AuthState {
  session: Session | null;
  role: StaffRole | null;
  loading: boolean;
  // True when signed in but the account has no active staff row.
  notStaff: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
  notStaff: false,
});

// Mirrors apps/web's session pattern, adapted for a plain SPA: session refresh
// is handled by supabase-js itself; the SPA adds the staff-role lookup that
// Next.js does not need. Role gating is still enforced by RLS — this context
// only decides what UI to render.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    role: null,
    loading: true,
    notStaff: false,
  });

  async function loadRole(session: Session | null) {
    if (!session) {
      setState({ session: null, role: null, loading: false, notStaff: false });
      return;
    }
    // staff_select RLS lets any signed-in user see their own staff row.
    const { data } = await supabase
      .from("staff")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("active_status", true)
      .maybeSingle();

    setState({
      session,
      role: (data?.role as StaffRole) ?? null,
      loading: false,
      notStaff: !data,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadRole(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => loadRole(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
