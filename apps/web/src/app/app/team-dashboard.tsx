"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { r2Url } from "@/lib/r2";

// Existing-team view on /app: team details editor + links into roster/positions
// and this team's match history. Match history is server-rendered by the parent
// page and passed down as a prop (keeps this component purely interactive).
export function TeamDashboard({
  team,
  matches,
}: {
  team: { id: string; name: string; description: string | null; logo_r2_key: string | null };
  matches: {
    id: string;
    status: string;
    team1_name: string;
    team2_name: string;
    team1_goals: number;
    team2_goals: number;
    created_at: string;
  }[];
}) {
  const supabase = createClient();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoUrl = team.logo_r2_key ? r2Url(team.logo_r2_key) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const { error: updateError } = await supabase
      .from("teams")
      .update({ name, description: description || null })
      .eq("id", team.id);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else setSaved(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={`${team.name} logo`} className="h-16 w-16 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-green-800 text-xl font-bold text-white">
            {team.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="min-w-0 break-words text-2xl font-semibold">{team.name}</h1>
      </div>

      <form onSubmit={save} className="max-w-md space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Team details</h2>

        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            rows={3}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-green-700 px-6 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/app/players"
          className="rounded bg-neutral-900 px-5 py-2 font-medium text-white hover:bg-neutral-700"
        >
          Manage players &amp; positions
        </Link>
      </div>

      <section>
        <h2 className="mb-3 font-medium">Match history</h2>
        {matches.length === 0 ? (
          <p className="py-8 text-center text-sm opacity-60">
            No matches yet — an admin creates matches between registered teams.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50"
                >
                  <span className="min-w-0 truncate text-sm">
                    {m.team1_name} <span className="font-semibold">{m.team1_goals}–{m.team2_goals}</span> {m.team2_name}
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-wide opacity-60">{m.status.replace(/_/g, " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
