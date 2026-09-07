import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activity-log";
import {
  MATCH_STATUSES,
  canTransitionMatch,
  matchDisplayName,
  type CardType,
  type EventType,
  type MatchStatus,
} from "@brotherssportszone/shared";

interface EventRow {
  id: string;
  event_type: string;
  minute: number;
  player_name: string;
  team_id: string | null;
  details_json: Record<string, unknown> | null;
  created_at: string;
}

// Live match control (§5.3/§5.4): manual status progression (no timer) and
// goal/card event logging. Every status change and event write goes through
// logActivity() with its own action_type.
export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { session } = useAuth();

  const [status, setStatus] = useState<MatchStatus | null>(null);
  const [sides, setSides] = useState<{
    team1: { id: string | null; name: string };
    team2: { id: string | null; name: string };
  } | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Event form state
  const [eventType, setEventType] = useState<EventType>("goal");
  const [cardType, setCardType] = useState<CardType>("yellow");
  const [minute, setMinute] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [side, setSide] = useState<"1" | "2">("1");
  const [savingEvent, setSavingEvent] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const { data: m, error: mError } = await supabase
        .from("matches")
        .select(
          "id, status, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
           team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name)",
        )
        .eq("id", matchId)
        .maybeSingle();
      if (mError || !m) {
        setError(mError?.message ?? "Match not found.");
        return;
      }
      setStatus(m.status as MatchStatus);
      setSides({
        team1: {
          id: m.team1_id,
          name: matchDisplayName(
            (m.team1 as { name: string }[] | null)?.[0]
              ? { name: (m.team1 as { name: string }[])[0].name }
              : { name_adhoc: m.team1_name_adhoc },
          ),
        },
        team2: {
          id: m.team2_id,
          name: matchDisplayName(
            (m.team2 as { name: string }[] | null)?.[0]
              ? { name: (m.team2 as { name: string }[])[0].name }
              : { name_adhoc: m.team2_name_adhoc },
          ),
        },
      });

      const { data: evts } = await supabase
        .from("match_events")
        .select("id, event_type, minute, player_name, team_id, details_json, created_at")
        .eq("match_id", matchId)
        .order("minute");
      setEvents((evts ?? []) as EventRow[]);
    })();
  }, [matchId]);

  const nextStatus =
    status !== null && MATCH_STATUSES.indexOf(status) < MATCH_STATUSES.length - 1
      ? MATCH_STATUSES[MATCH_STATUSES.indexOf(status) + 1]
      : null;

  async function advanceStatus() {
    if (!status || !nextStatus || !matchId) return;
    setError(null);
    const { error: updateError } = await supabase
      .from("matches")
      .update({ status: nextStatus })
      .eq("id", matchId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus(nextStatus);

    if (session) {
      const { error: logError } = await logActivity(supabase, session.user.id, {
        actionType: "match_status_changed",
        resourceType: "match",
        resourceId: matchId,
        details: { before: { status }, after: { status: nextStatus } },
      });
      if (logError) console.warn("activity_log write failed:", logError);
    }
  }

  async function logEvent(e: FormEvent) {
    e.preventDefault();
    if (!matchId || !sides) return;
    const minuteNum = Number(minute);
    if (!playerName.trim() || Number.isNaN(minuteNum) || minuteNum < 0 || minuteNum > 130) {
      setError("Enter a player name and a minute between 0 and 130.");
      return;
    }

    const teamId = side === "1" ? sides.team1.id : sides.team2.id;
    const insert = {
      match_id: matchId,
      event_type: eventType,
      minute: minuteNum,
      player_name: playerName.trim(),
      team_id: teamId,
      details_json: eventType === "card" ? { card: cardType } : {},
    };

    setSavingEvent(true);
    const { data: created, error: insertError } = await supabase
      .from("match_events")
      .insert(insert)
      .select("id, event_type, minute, player_name, team_id, details_json, created_at")
      .single();
    setSavingEvent(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setEvents((es) => [...es, created as EventRow].sort((a, b) => a.minute - b.minute));
    setPlayerName("");
    setMinute("");

    if (session) {
      const { error: logError } = await logActivity(supabase, session.user.id, {
        actionType: "match_event_logged",
        resourceType: "match_event",
        resourceId: created.id,
        // insert already contains match_id — spread last so the explicit key
        // and the spread don't fight (TS2783).
        details: { ...insert },
      });
      if (logError) console.warn("activity_log write failed:", logError);
    }
  }

  if (!sides || !status) {
    return <p className="py-8 text-sm opacity-60">{error ?? "Loading…"}</p>;
  }

  return (
    <section className="space-y-8">
      <h1 className="text-xl font-semibold">
        {sides.team1.name} vs {sides.team2.name}
      </h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Status progression — one step at a time, no skip (canTransitionMatch). */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium capitalize">{status.replace(/_/g, " ")}</span>
        {nextStatus ? (
          <button
            onClick={advanceStatus}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Advance to {nextStatus.replace(/_/g, " ")}
          </button>
        ) : (
          <span className="text-xs uppercase tracking-wide opacity-50">Full time — complete</span>
        )}
      </div>

      <form onSubmit={logEvent} className="max-w-xl space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Log event</h2>

        <div className="flex gap-2 text-xs">
          {(["goal", "card"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEventType(t)}
              className={`rounded px-3 py-1.5 ${eventType === t ? "bg-green-700 text-white" : "border"}`}
            >
              {t === "goal" ? "⚽ Goal" : "🟨 Card"}
            </button>
          ))}
          {eventType === "card" && (
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="rounded border px-2 py-1.5"
            >
              <option value="yellow">Yellow</option>
              <option value="red">Red</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Minute</span>
            <input
              type="number"
              min={0}
              max={130}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Player</span>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Scorer / booked player"
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Side</span>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "1" | "2")}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            <option value="1">{sides.team1.name}</option>
            <option value="2">{sides.team2.name}</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={savingEvent}
          className="rounded bg-green-700 px-6 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {savingEvent ? "Saving…" : "Log event"}
        </button>
      </form>

      <div>
        <h2 className="mb-2 font-medium">Events ({events.length})</h2>
        {events.length === 0 ? (
          <p className="py-4 text-sm opacity-60">No events yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-10 font-bold tabular-nums opacity-70">{e.minute}&apos;</span>
                <span aria-hidden>{e.event_type === "goal" ? "⚽" : e.details_json?.card === "red" ? "🟥" : "🟨"}</span>
                <span className="font-medium">{e.player_name}</span>
                <span className="ml-auto text-xs opacity-60">
                  {e.team_id === sides.team1.id ? sides.team1.name : sides.team2.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
