import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deriveScore, matchDisplayName, type MatchStatus } from "@brotherssportszone/shared";

// Public live-score list (§5.6) — Flashscore-style. Live matches first, then
// the most recent finished ones. Realtime badge updates via the client island.
export const metadata: Metadata = {
  title: "Matches — BrothersSportsZone",
  description: "Live football scores and recent results at BrothersSportsZone.",
  alternates: { canonical: "/matches" },
};

const LIVE_STATUSES: MatchStatus[] = ["first_half", "half_time", "second_half"];

export default async function MatchesPage() {
  const supabase = await createClient();

  // Live matches (in-progress statuses) + recent finished, one joined query —
  // PostgREST `in` on status then a second limited query for finished keeps
  // the "live pinned to top" ordering without a composite index change.
  const { data: liveRows } = await supabase
    .from("matches")
    .select(
      "id, status, match_format, created_at, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), \
       team2:teams!matches_team2_id_fkey(name), \
       match_events(event_type, team_id)",
    )
    .in("status", LIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: recentRows } = await supabase
    .from("matches")
    .select(
      "id, status, match_format, created_at, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), \
       team2:teams!matches_team2_id_fkey(name), \
       match_events(event_type, team_id)",
    )
    .eq("status", "full_time")
    .order("created_at", { ascending: false })
    .limit(10);

  const shape = (rows: typeof liveRows) =>
    (rows ?? []).map((m) => {
      const events = m.match_events ?? [];
      const { team1, team2 } = deriveScore(events, m.team1_id, m.team2_id);
      return {
        id: m.id as string,
        status: m.status as MatchStatus,
        format: m.match_format as string,
        team1_name: matchDisplayName(m.team1?.[0] ? { name: m.team1[0].name } : { name_adhoc: m.team1_name_adhoc }),
        team2_name: matchDisplayName(m.team2?.[0] ? { name: m.team2[0].name } : { name_adhoc: m.team2_name_adhoc }),
        team1_goals: team1,
        team2_goals: team2,
      };
    });

  const live = shape(liveRows);
  const recent = shape(recentRows);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Matches</h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Live now</h2>
        {live.length === 0 ? (
          <p className="py-6 text-sm opacity-60">No live matches right now.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {live.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                  <MatchRow match={m} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">Recent results</h2>
        {recent.length === 0 ? (
          <p className="py-6 text-sm opacity-60">No finished matches yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-lg border">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                  <MatchRow match={m} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MatchRow({
  match,
}: {
  match: {
    id: string;
    status: MatchStatus;
    format: string;
    team1_name: string;
    team2_name: string;
    team1_goals: number;
    team2_goals: number;
  };
}) {
  const isLive = match.status !== "not_started" && match.status !== "full_time";
  return (
    <>
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
          isLive ? "animate-pulse bg-red-600 text-white" : "bg-neutral-200 text-neutral-600"
        }`}
      >
        {isLive ? "Live" : match.status === "full_time" ? "FT" : "Upcoming"}
      </span>
      <span className="flex flex-1 items-center justify-between gap-2 text-sm">
        <span className="truncate font-medium">{match.team1_name}</span>
        <span className="shrink-0 font-bold tabular-nums">
          {match.status === "not_started" ? "vs" : `${match.team1_goals}–${match.team2_goals}`}
        </span>
        <span className="truncate font-medium">{match.team2_name}</span>
      </span>
      <span className="shrink-0 text-xs opacity-50">{match.format}</span>
    </>
  );
}
