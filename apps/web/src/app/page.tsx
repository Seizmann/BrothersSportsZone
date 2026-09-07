import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deriveScore, matchDisplayName, type MatchStatus } from "@brotherssportszone/shared";

// Landing page (§6): hero + live matches + recent results + booking CTA.
// Flashscore-inspired; all sections server-rendered, LIVE badge pulse is pure
// CSS (animate-pulse), no JS animation library.
export const metadata: Metadata = {
  title: "BrothersSportsZone — Turf booking & live football scores",
  description: "Book your turf slot and follow live football scores at BrothersSportsZone.",
  alternates: { canonical: "/" },
};

const LIVE_STATUSES: MatchStatus[] = ["first_half", "half_time", "second_half"];

export default async function Home() {
  const supabase = await createClient();

  const { data: liveRows } = await supabase
    .from("matches")
    .select(
      "id, status, match_format, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name), \
       match_events(event_type, team_id)",
    )
    .in("status", LIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentRows } = await supabase
    .from("matches")
    .select(
      "id, status, match_format, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name), \
       match_events(event_type, team_id)",
    )
    .eq("status", "full_time")
    .order("created_at", { ascending: false })
    .limit(5);

  const shape = (rows: typeof liveRows) =>
    (rows ?? []).map((m) => {
      const { team1, team2 } = deriveScore(m.match_events ?? [], m.team1_id, m.team2_id);
      return {
        id: m.id,
        status: m.status as MatchStatus,
        team1_name: matchDisplayName(m.team1?.[0] ? { name: m.team1[0].name } : { name_adhoc: m.team1_name_adhoc }),
        team2_name: matchDisplayName(m.team2?.[0] ? { name: m.team2[0].name } : { name_adhoc: m.team2_name_adhoc }),
        team1_goals: team1,
        team2_goals: team2,
      };
    });

  const live = shape(liveRows);
  const recent = shape(recentRows);

  return (
    <main>
      {/* Hero — football-field background, inline SVG so it scales with the box. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-green-900 to-green-950 text-white">
        <svg
          viewBox="0 0 800 400"
          className="pointer-events-none absolute inset-0 h-full w-full text-white/10"
          aria-hidden
        >
          <rect x="10" y="10" width="780" height="380" fill="none" stroke="currentColor" strokeWidth="3" />
          <line x1="10" y1="200" x2="790" y2="200" stroke="currentColor" strokeWidth="3" />
          <circle cx="400" cy="200" r="60" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="200" y="10" width="400" height="80" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="200" y="310" width="400" height="80" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">BrothersSportsZone</h1>
          <p className="mt-4 max-w-xl text-lg text-green-100">
            Book your turf slot and follow every match live — scores, goals and cards as they happen.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/book"
              className="rounded-lg bg-white px-6 py-3 font-medium text-green-900 transition hover:bg-green-50"
            >
              Book a slot
            </Link>
            <Link
              href="/matches"
              className="rounded-lg border border-white/40 px-6 py-3 font-medium transition hover:bg-white/10"
            >
              View matches
            </Link>
          </div>
        </div>
      </section>

      {/* Live matches */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            Live matches
            {live.length > 0 && (
              <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Live
              </span>
            )}
          </h2>
          <Link href="/matches" className="text-sm text-green-800 underline hover:no-underline">
            All matches
          </Link>
        </div>

        {live.length === 0 ? (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm opacity-60">
            No live matches right now — check back soon.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white shadow-sm">
            {live.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-green-50">
                  <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                    Live
                  </span>
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="truncate font-medium">{m.team1_name}</span>
                    <span className="shrink-0 text-lg font-bold tabular-nums">
                      {m.team1_goals}–{m.team2_goals}
                    </span>
                    <span className="truncate font-medium">{m.team2_name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent results */}
      {recent.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-12">
          <h2 className="mb-4 text-xl font-semibold">Recent results</h2>
          <ul className="divide-y rounded-xl border bg-white shadow-sm">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-green-50">
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-neutral-600">
                    FT
                  </span>
                  <span className="flex flex-1 items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{m.team1_name}</span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {m.team1_goals}–{m.team2_goals}
                    </span>
                    <span className="truncate font-medium">{m.team2_name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Booking CTA strip */}
      <section className="border-t bg-green-900 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-12 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="text-xl font-semibold">Own the pitch</h2>
            <p className="mt-1 text-sm text-green-100">Reserve your slot at our turf — quick and manual-payment friendly.</p>
          </div>
          <Link
            href="/book"
            className="rounded-lg bg-white px-6 py-3 font-medium text-green-900 transition hover:bg-green-50"
          >
            Book now
          </Link>
        </div>
      </section>
    </main>
  );
}
