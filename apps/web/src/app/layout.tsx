import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import "./globals.css";

// Root layout — title/metadata become DB-driven per REQUIREMENT.md §6.2 once site_settings is wired.
export const metadata: Metadata = {
  title: "BrothersSportsZone",
  description: "Turf booking and live football scores.",
};

// Minimal top nav. Login/logout state comes from the session; logout is a POST
// form (route handler redirects back to /login).
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        <header className="border-b">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              BrothersSportsZone
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/book" className="hover:underline">
                Book
              </Link>
              <Link href="/matches" className="hover:underline">
                Matches
              </Link>
              <Link href="/teams" className="hover:underline">
                Teams
              </Link>
              <Link href="/my-bookings" className="hover:underline">
                My bookings
              </Link>
              {session ? (
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="hover:underline">
                    Log out
                  </button>
                </form>
              ) : (
                <Link href="/login" className="hover:underline">
                  Log in
                </Link>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
