import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSlotsForDate, slotConfigSchema } from "@brotherssportszone/shared";

// GET /api/slots?date=YYYY-MM-DD — public availability check, no auth needed.
// Merges the admin-configured slot layout with already-taken slots.
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date query param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: settings, error: settingsErr } = await supabase
    .from("site_settings")
    .select("slot_per_day_json")
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json({ error: "site_settings not configured" }, { status: 500 });
  }

  const config = slotConfigSchema.parse(settings.slot_per_day_json);
  // Midnight anchor: getSlotsForDate only reads the weekday, and the date string
  // is the Dhaka-local date passed by the UI picker (timezone fixed per REQUIREMENT.md §3).
  const allSlots = getSlotsForDate(config, new Date(date + "T00:00:00"));

  // bookings RLS hides other users' rows, so taken slots must come through the
  // security-definer helper — it exposes only "this time is taken", no customer data.
  const { data: taken, error: takenErr } = await supabase.rpc("get_taken_slot_times", {
    p_slot_date: date,
  });

  if (takenErr) {
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }

  // PostgREST returns Postgres time as "HH:mm:ss" — normalise to the shared
  // package's "HH:mm" format before comparing.
  const takenTimes = new Set((taken ?? []).map((b: { slot_time: string }) => b.slot_time.slice(0, 5)));

  const available = allSlots.filter((s) => !takenTimes.has(s.start_time));

  return NextResponse.json({ slots: available, date });
}
