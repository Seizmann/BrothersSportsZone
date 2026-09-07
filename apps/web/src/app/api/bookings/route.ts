import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import {
  getSlotsForDate,
  calculateBookingCost,
  slotConfigSchema,
  pricingRulesSchema,
} from "@brotherssportszone/shared";

// POST /api/bookings — create a booking (auth required).
// Server-side validation: slot must exist for the date, cost is always computed
// from site_settings (never trusted from the client), and the atomic
// create_booking RPC writes booking + payment rows together.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { slotDate, slotTime, customerName, customerPhone, teamName } = body ?? {};

  if (
    !slotDate || !/^\d{4}-\d{2}-\d{2}$/.test(slotDate) ||
    !slotTime || !/^\d{2}:\d{2}$/.test(slotTime) ||
    !customerName || !customerPhone
  ) {
    return NextResponse.json(
      { error: "slotDate (YYYY-MM-DD), slotTime (HH:mm), customerName, customerPhone required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("slot_per_day_json, pricing_rules_json")
    .single();

  if (!settings) {
    return NextResponse.json({ error: "site_settings not configured" }, { status: 500 });
  }

  const config = slotConfigSchema.parse(settings.slot_per_day_json);
  const rules = pricingRulesSchema.parse(settings.pricing_rules_json);
  const dateObj = new Date(slotDate + "T00:00:00");

  // The requested slot must be one the admin config actually offers for this date.
  const isValidSlot = getSlotsForDate(config, dateObj).some((s) => s.start_time === slotTime);
  if (!isValidSlot) {
    return NextResponse.json({ error: "Invalid slot for this date" }, { status: 422 });
  }

  const bookingCost = calculateBookingCost(rules, dateObj, slotTime);

  const { data: turf } = await supabase.from("turf").select("id").single();
  if (!turf) {
    return NextResponse.json({ error: "Turf not configured" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_user_id: session.user.id,
    p_turf_id: turf.id,
    p_slot_date: slotDate,
    p_slot_time: slotTime,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_team_name: teamName ?? null,
    p_booking_cost: bookingCost,
  });

  if (error) {
    // 23505 = slot conflict (either the friendly check or the partial unique index).
    const conflict = error.code === "23505" || error.message.includes("already booked");
    return NextResponse.json(
      { error: conflict ? "Slot is already booked" : error.message },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ booking: data }, { status: 201 });
}
