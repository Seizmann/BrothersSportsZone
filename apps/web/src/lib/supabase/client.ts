import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. createBrowserClient memoises the instance
// internally per (url, key), so a factory is enough — no manual singleton.
// ponytail: no DB generic type arg yet; add when generated types land in packages/database.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
