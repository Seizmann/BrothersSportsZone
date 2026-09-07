import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PlayersManager } from "./players-manager";

// Roster + drag-to-position layout (§5.5). Owner-only; the team must already
// exist (created from /app).
export const metadata: Metadata = {
  title: "Players & positions — BrothersSportsZone",
  robots: { index: false },
};

export default async function PlayersPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("owner_user_id", session.user.id)
    .maybeSingle();
  if (!team) redirect("/app"); // no team yet — creation lives there

  const { data: players } = await supabase
    .from("team_players")
    .select("id, player_name, player_photo_r2_key, position_x, position_y")
    .eq("team_id", team.id)
    .order("player_name");

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PlayersManager teamId={team.id} teamName={team.name} initialPlayers={players ?? []} />
    </main>
  );
}
