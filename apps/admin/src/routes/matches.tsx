import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activity-log";
import {
  MATCH_FORMATS,
  matchDisplayName,
  type MatchFormat,
} from "@brotherssportszone/shared";

interface MatchRow {
  id: string;
  status: string;
  match_format: string;
  created_at: string;
  team1_id: string | null;
  team2_id: string | null;
  team1_name_adhoc: string | null;
  team2_name_adhoc: string | null;
  team1: { name: string }[] | null;
  team2: { name: string }[] | null;
}

// Match list + creation (§5.2/§5.3). Each side of the new match is either a
// registered team (search/select) or an ad-hoc name — exactly one per side,
// enforced by the match_side_valid check constraints. All staff roles can
// create/progress matches (approved flag #1: operational, not financial).
export function MatchesPage() {
  const { session } = useAuth();

  // Side picker state — mode toggles between registered team and ad-hoc name.
  const [side1Mode, setSide1Mode] = useState<"team" | "adhoc">("team");
  const [side2Mode, setSide2Mode] = useState<"team" | "adhoc">("team");
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");
  const [team1Adhoc, setTeam1Adhoc] = useState("");
  const [team2Adhoc, setTeam2Adhoc] = useState("");
  const [format, setFormat] = useState<MatchFormat>(MATCH_FORMATS[0]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name").limit(500);
      if (!error) setTeams(data ?? []);
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    setListError(null);
    (async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, status, match_format, created_at, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
           team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) setListError(error.message);
      else setRows((data ?? []) as unknown as MatchRow[]);
      setLoading(false);
    })();
  }, [reloadKey]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Exactly one of (team id, ad-hoc name) per side — mirrors the DB
    // check constraint; validate here for a friendly error message.
    if (side1Mode === "team" && !team1Id) return setFormError("Pick a registered team for side 1 or switch to ad-hoc name.");
    if (side2Mode === "adhoc" && !team2Adhoc.trim()) return setFormError("Enter an ad-hoc name for side 2 or pick a team.");
    if (side1Mode === "adhoc" && !team1Adhoc.trim()) return setFormError("Enter an ad-hoc name for side 1 or pick a team.");
    if (side2Mode === "team" && !team2Id) return setFormError("Pick a registered team for side 2 or switch to ad-hoc name.");

    const insert = {
      team1_id: side1Mode === "team" ? team1Id : null,
      team2_id: side2Mode === "team" ? team2Id : null,
      team1_name_adhoc: side1Mode === "adhoc" ? team1Adhoc.trim() : null,
      team2_name_adhoc: side2Mode === "adhoc" ? team2Adhoc.trim() : null,
      match_format: format,
    };

    setSaving(true);
    const { data: created, error } = await supabase
      .from("matches")
      .insert(insert)
      .select("id")
      .single();
    setSaving(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    // Audit trail (§4.6) — same non-transactional pattern as expenses: the
    // match exists, the log write failing is a warning, not a rollback.
    if (session) {
      const { error: logError } = await logActivity(supabase, session.user.id, {
        actionType: "match_created",
        resourceType: "match",
        resourceId: created.id,
        details: insert,
      });
      if (logError) console.warn("activity_log write failed:", logError);
    }

    setTeam1Id("");
    setTeam2Id("");
    setTeam1Adhoc("");
    setTeam2Adhoc("");
    setReloadKey((k) => k + 1);
  }

  return (
    <section className="space-y-8">
      <h1 className="text-xl font-semibold">Matches</h1>

      <form onSubmit={handleCreate} className="max-w-xl space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Create match</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <SidePicker
            label="Team 1"
            mode={side1Mode}
            setMode={setSide1Mode}
            teams={teams}
            teamId={team1Id}
            setTeamId={setTeam1Id}
            adhoc={team1Adhoc}
            setAdhoc={setTeam1Adhoc}
          />
          <SidePicker
            label="Team 2"
            mode={side2Mode}
            setMode={setSide2Mode}
            teams={teams}
            teamId={team2Id}
            setTeamId={setTeam2Id}
            adhoc={team2Adhoc}
            setAdhoc={setTeam2Adhoc}
          />
        </div>

        <label className="block">
          <span className="text-sm font-medium">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as MatchFormat)}
            className="mt-1 w-full rounded border px-3 py-2"
          >
            {MATCH_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-green-700 px-6 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create match"}
        </button>
      </form>

      <div>
        <h2 className="mb-2 font-medium">All matches</h2>
        {loading ? (
          <p className="py-6 text-sm opacity-60">Loading…</p>
        ) : listError ? (
          <p className="text-sm text-red-600">{listError}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm opacity-60">No matches yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((m) => {
              const t1 = matchDisplayName(m.team1?.[0] ? { name: m.team1[0].name } : { name_adhoc: m.team1_name_adhoc });
              const t2 = matchDisplayName(m.team2?.[0] ? { name: m.team2[0].name } : { name_adhoc: m.team2_name_adhoc });
              return (
                <li key={m.id}>
                  <Link
                    to={`/matches/${m.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium">
                      {t1} vs {t2}
                    </span>
                    <span className="text-xs uppercase tracking-wide opacity-60">
                      {m.status.replace(/_/g, " ")} · {m.match_format}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function SidePicker({
  label,
  mode,
  setMode,
  teams,
  teamId,
  setTeamId,
  adhoc,
  setAdhoc,
}: {
  label: string;
  mode: "team" | "adhoc";
  setMode: (m: "team" | "adhoc") => void;
  teams: { id: string; name: string }[];
  teamId: string;
  setTeamId: (v: string) => void;
  adhoc: string;
  setAdhoc: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("team")}
          className={`rounded px-2 py-1 ${mode === "team" ? "bg-green-700 text-white" : "border"}`}
        >
          Registered team
        </button>
        <button
          type="button"
          onClick={() => setMode("adhoc")}
          className={`rounded px-2 py-1 ${mode === "adhoc" ? "bg-green-700 text-white" : "border"}`}
        >
          Ad-hoc name
        </button>
      </div>
      {mode === "team" ? (
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">— pick a team —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={adhoc}
          onChange={(e) => setAdhoc(e.target.value)}
          placeholder="e.g. Sunday casuals"
          className="w-full rounded border px-3 py-2"
        />
      )}
    </fieldset>
  );
}
