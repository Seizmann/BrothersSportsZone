import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { deriveScore, matchDisplayName } from "@brotherssportszone/shared";

// OG score-card preview per match (cross-module SEO requirement). 1200×630,
// PNG via next/og — no new dependencies, rendered on-demand and cached by the
// OG consumer (Slack/WhatsApp/Twitter cache aggressively).
export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId || !/^[0-9a-f-]{36}$/i.test(matchId)) {
    return new Response("bad matchId", { status: 400 });
  }

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("matches")
    .select(
      "status, match_format, team1_id, team2_id, team1_name_adhoc, team2_name_adhoc, \
       team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name), \
       match_events(event_type, team_id)",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (!m) return new Response("not found", { status: 404 });

  const t1 = matchDisplayName(m.team1?.[0] ? { name: m.team1[0].name } : { name_adhoc: m.team1_name_adhoc });
  const t2 = matchDisplayName(m.team2?.[0] ? { name: m.team2[0].name } : { name_adhoc: m.team2_name_adhoc });
  const { team1, team2 } = deriveScore(m.match_events ?? [], m.team1_id, m.team2_id);
  const score = m.status === "not_started" ? "vs" : `${team1} – ${team2}`;
  const statusLabel = m.status.replace(/_/g, " ").toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #14532d 0%, #052e16 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#86efac", marginBottom: 24 }}>
          {statusLabel} · {m.match_format}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, maxWidth: 400, textAlign: "center" }}>{t1}</div>
          <div style={{ display: "flex", fontSize: 110, fontWeight: 800 }}>{score}</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, maxWidth: 400, textAlign: "center" }}>{t2}</div>
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 40, color: "#bbf7d0" }}>
          BrothersSportsZone
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
