"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { r2Url } from "@/lib/r2";
import { deriveScore, type MatchStatus } from "@brotherssportszone/shared";

type MatchEvent = {
  id: string;
  event_type: string;
  minute: number;
  player_name: string;
  team_id: string | null;
  details_json: Record<string, unknown> | null;
  created_at: string;
};

type Match = {
  id: string;
  status: MatchStatus;
  format: string;
  team1: { id: string | null; name: string; logo_r2_key: string | null };
  team2: { id: string | null; name: string; logo_r2_key: string | null };
};

// Live island on the match detail page (§5.7): subscribes to match_events
// inserts + matches updates so an admin-logged goal appears within seconds
// with no refresh — the hard acceptance criterion.
export function MatchLive({ match, initialEvents }: { match: Match; initialEvents: MatchEvent[] }) {
  const supabase = createClient();
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [events, setEvents] = useState<MatchEvent[]>(initialEvents);

  useEffect(() => {
    const channel = supabase
      .channel(`match:${match.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${match.id}` },
        (payload) => {
          // Append, then sort by minute so feed order stays correct even if
          // two events arrive out of order.
          setEvents((es) =>
            [...es, payload.new as MatchEvent].sort((a, b) => a.minute - b.minute || a.created_at.localeCompare(b.created_at)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${match.id}` },
        (payload) => {
          setStatus(payload.new.status as MatchStatus);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [match.id, supabase]);

  const { team1, team2 } = deriveScore(events, match.team1.id, match.team2.id);
  const isLive = status === "first_half" || status === "half_time" || status === "second_half";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-gradient-to-b from-neutral-50 to-neutral-100 p-4 text-center sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-widest opacity-60">
          {isLive && (
            <span className="animate-pulse rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
              Live
            </span>
          )}
          <span>{status.replace(/_/g, " ")}</span>
          <span>· {match.format}</span>
        </div>

        {/* Flex row (not grid-cols-3): team names shrink and wrap instead of
            blowing the grid out on 320px screens. */}
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          <div className="min-w-0 flex-1">
            <TeamBlock name={match.team1.name} logoKey={match.team1.logo_r2_key} />
          </div>
          <div className="shrink-0 text-3xl font-bold tabular-nums sm:text-4xl">
            {status === "not_started" ? "vs" : `${team1}–${team2}`}
          </div>
          <div className="min-w-0 flex-1">
            <TeamBlock name={match.team2.name} logoKey={match.team2.logo_r2_key} />
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">Events</h2>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">No events logged yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-10 shrink-0 font-bold tabular-nums opacity-70">{e.minute}&apos;</span>
                <span aria-hidden className="shrink-0">
                  {e.event_type === "goal" ? "⚽" : (e.details_json?.card as string) === "red" ? "🟥" : "🟨"}
                </span>
                <span className="min-w-0 truncate font-medium">{e.player_name}</span>
                <span className="ml-auto min-w-0 truncate text-xs opacity-60">
                  {e.team_id === match.team1.id ? match.team1.name : e.team_id === match.team2.id ? match.team2.name : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TeamBlock({ name, logoKey }: { name: string; logoKey: string | null }) {
  const logo = logoKey ? r2Url(logoKey) : null;
  return (
    <div className="flex flex-col items-center gap-2">
      {logo ? (
        <img src={logo} alt="" className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-green-800 text-sm font-bold text-white">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-semibold leading-tight">{name}</span>
    </div>
  );
}
