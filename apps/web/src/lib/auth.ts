import { createClient } from "@/lib/supabase/server";

/** Returns the current session or null. For Server Components and Route Handlers. */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
