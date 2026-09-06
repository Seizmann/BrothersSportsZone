import { createClient } from "@supabase/supabase-js";

// Direct browser client (no @supabase/ssr — this is a plain SPA).
// Role gating happens via RLS + the staff table check in AuthContext.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
