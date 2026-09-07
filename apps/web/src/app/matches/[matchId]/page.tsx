import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveScore, matchDisplayName } from "@brotherssportszone/shared";
import { MatchLive } from "./match-live";

// Public match detail (§5.6/§5.7): live score, event feed, Realtime updates.
type Params = { params: Promise<{ matchId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { matchId } = await params;
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("matches")
    .select(
      "status, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), \
       team2:teams!matches_team2_id_fkey(name)",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (!m) return { title: "Match not found — BrothersSportsZone" };

  const t1 = matchDisplayName(m.team1?.[0] ? { name: m.team1[0].name } : { name_adhoc: m.team1_name_adhoc });
  const t2 = matchDisplayName(m.team2?.[0] ? { name: m.team2[0].name } : { name_adhoc: m.team2_name_adhoc });
  const title = `${t1} vs ${t2} — BrothersSportsZone`;
  return {
    title,
    description: `Live score and events for ${t1} vs ${t2}.`,
    alternates: { canonical: `/matches/${matchId}` },
    openGraph: {
      title,
      description: `Live score and events for ${t1} vs ${t2}.`,
      images: [{ url: `/api/og?matchId=${matchId}` }],
    },
  };
}

export default async function MatchPage({ params }: Params) {
  const { matchId } = await params;
  const supabase = await createClient();

  const { data: m } = await supabase
    .from("matches")
    .select(
      "id, status, match_format, created_at, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name, logo_r2_key), \
       team2:teams!matches_team2_id_fkey(name, logo_r2_key), \
       match_events(id, event_type, minute, player_name, team_id, details_json, created_at)",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (!m) notFound();

  const t1 = m.team1?.[0] ?? null;
  const t2 = m.team2?.[0] ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <MatchLive
        match={{
          id: m.id,
          status: m.status,
          format: m.match_format,
          team1: { id: m.team1_id, name: t1?.name ?? m.team1_name_adhoc ?? "TBD", logo_r2_key: t1?.logo_r2_key ?? null },
          team2: { id: m.team2_id, name: t2?.name ?? m.team2_name_adhoc ?? "TBD", logo_r2_key: t2?.logo_r2_key ?? null },
        }}
        initialEvents={m.match_events ?? []}
      />

      {/* LD+JSON SportsEvent for the match (cross-module SEO requirement). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `${t1?.name ?? m.team1_name_adhoc} vs ${t2?.name ?? m.team2_name_adhoc}`,
            startDate: m.created_at,
            eventStatus:
              m.status === "full_time"
                ? "https://schema.org/EventScheduled"
                : "https://schema.org/EventScheduled",
            competitor: [
              { "@type": "SportsTeam", name: t1?.name ?? m.team1_name_adhoc ?? "TBD" },
              { "@type": "SportsTeam", name: t2?.name ?? m.team2_name_adhoc ?? "TBD" },
            ],
          }),
        }}
      />
    </main>
  );
}
