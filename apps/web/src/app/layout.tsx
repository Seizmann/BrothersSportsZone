import type { Metadata } from "next";

// Root layout — title/metadata become DB-driven per REQUIREMENT.md §6.2 once site_settings is wired.
export const metadata: Metadata = {
  title: "BrothersSportsZone",
  description: "Turf booking and live football scores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
