import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { SiteNav } from "./site-nav";
import "./globals.css";

// Root layout — title/metadata become DB-driven per REQUIREMENT.md §6.2 once site_settings is wired.
export const metadata: Metadata = {
  title: "BrothersSportsZone",
  description: "Turf booking and live football scores.",
};

// Top nav collapses to a hamburger below md (768px) — see SiteNav. Login/
// logout state comes from the session; logout is a POST form (route handler
// redirects back to /login).
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        {/* relative anchors the SiteNav mobile dropdown panel */}
        <header className="relative border-b">
          <SiteNav loggedIn={Boolean(session)} />
        </header>
        {children}
      </body>
    </html>
  );
}
