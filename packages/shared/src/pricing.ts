import { z } from "zod";

// Pricing is DB-driven from site_settings.pricing_rules_json (REQUIREMENT.md §4.2).
// Supports flat rate, day-wise, and hour-of-day (peak) pricing. All amounts in BDT.
//
// Example:
// {
//   "default_price": 1200,          // flat rate per slot
//   "day_prices":  { "5": 1500 },   // weekday override, 0=Sun..6=Sat (Friday dearer)
//   "hour_prices": { "18": 2000 }   // peak-hour override, takes precedence over day
// }
export const pricingRulesSchema = z.object({
  default_price: z.number().positive(),
  day_prices: z.record(z.string(), z.number().positive()).optional(),
  hour_prices: z.record(z.string(), z.number().positive()).optional(),
});

export type PricingRules = z.infer<typeof pricingRulesSchema>;

/**
 * Resolve the booking cost for a slot. Precedence: specific hour > day > flat default.
 * Weekday comes from the slot_date, hour from the slot_time — both are plain lookups
 * so the caller passes dates already anchored to Asia/Dhaka (the fixed project timezone).
 */
export function calculateBookingCost(
  rules: PricingRules,
  slotDate: Date,
  slotTime: string // "HH:mm" — matches bookings.slot_time
): number {
  const hour = Number(slotTime.slice(0, 2));
  const weekday = String(slotDate.getDay()); // 0=Sun..6=Sat, matches day_prices keys

  return (
    rules.hour_prices?.[String(hour)] ??
    rules.day_prices?.[weekday] ??
    rules.default_price
  );
}
