import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { r2Url } from "@/lib/r2";

// Public team directory (§5.5) — every registered team, logo or initials
// fallback. No auth required (teams RLS: public read).
export const metadata: Metadata = {
  title: "Teams — BrothersSportsZone",
  description: "Registered teams at BrothersSportsZone.",
  alternates: { canonical: "/teams" },
};

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, description, logo_r2_key")
    .order("name");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Teams</h1>

      {!teams || teams.length === 0 ? (
        <p className="py-16 text-center opacity-60">
          No teams registered yet — <a href="/app" className="underline">create yours</a>.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {teams.map((t) => {
            const logo = t.logo_r2_key ? r2Url(t.logo_r2_key) : null;
            return (
              <li key={t.id} className="flex items-start gap-3 rounded-lg border p-4">
                {logo ? (
                  <img src={logo} alt={`${t.name} logo`} className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green-800 text-sm font-bold text-white">
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{t.name}</h2>
                  {t.description && (
                    <p className="mt-1 line-clamp-3 text-sm opacity-70">{t.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* LD+JSON ItemList of teams (cross-module SEO requirement). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: (teams ?? []).map((t, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: { "@type": "SportsTeam", name: t.name },
            })),
          }),
        }}
      />
    </main>
  );
}
