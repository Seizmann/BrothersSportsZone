import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { deriveScore, matchDisplayName } from "@brotherssportszone/shared";
import { TeamDashboard } from "./team-dashboard";
import { CreateTeamForm } from "./create-team-form";

// Team owner dashboard (§5.5). A user becomes eligible to create a team on
// first visit; the row is only created by an explicit "create team" action —
// never auto-inserted at signup (confirmed phase decision).
export const metadata: Metadata = {
  title: "My team — BrothersSportsZone",
  description: "Create and manage your BrothersSportsZone team.",
  robots: { index: false }, // personal dashboard, not for search engines
};

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="py-16 text-center opacity-60">
          Please <a href="/login" className="underline">log in</a> to manage your team.
        </p>
      </main>
    );
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, description, logo_r2_key")
    .eq("owner_user_id", session.user.id)
    .maybeSingle();

  if (!team) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <CreateTeamForm />
      </main>
    );
  }

  // This team's matches with both sides' names and derived scores. One joined
  // query per side keeps it to two requests; events come nested for scoring.
  const { data: rows } = await supabase
    .from("matches")
    .select(
      "id, status, created_at, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), \
       team2:teams!matches_team2_id_fkey(name), \
       match_events(event_type, team_id)",
    )
    .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`)
    .order("created_at", { ascending: false })
    .limit(20);

  const matches = (rows ?? []).map((m) => {
    const events = m.match_events ?? [];
    const { team1, team2 } = deriveScore(events, m.team1_id, m.team2_id);
    return {
      id: m.id,
      status: m.status,
      team1_name: matchDisplayName(m.team1?.[0] ? { name: m.team1[0].name } : { name_adhoc: m.team1_name_adhoc }),
      team2_name: matchDisplayName(m.team2?.[0] ? { name: m.team2[0].name } : { name_adhoc: m.team2_name_adhoc }),
      team1_goals: team1,
      team2_goals: team2,
      created_at: m.created_at,
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <TeamDashboard team={team} matches={matches} />
    </main>
  );
}
