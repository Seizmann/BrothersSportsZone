import { z } from "zod";

// Slot configuration from site_settings (REQUIREMENT.md §4.2): admin sets a global
// default day layout, with optional per-day overrides (e.g. Friday runs longer).
//
// Example:
// {
//   "default": { "open": "16:00", "close": "23:00", "duration_minutes": 90 },
//   "days": { "5": { "open": "14:00", "close": "23:00", "duration_minutes": 60 } }
// }
export const daySlotConfigSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:mm"),
  close: z.string().regex(/^\d{2}:\d{2}$/, "expected HH:mm"),
  duration_minutes: z.number().int().positive(),
});

export const slotConfigSchema = z.object({
  default: daySlotConfigSchema,
  days: z.record(z.string(), daySlotConfigSchema).optional(),
});

export type DaySlotConfig = z.infer<typeof daySlotConfigSchema>;
export type SlotConfig = z.infer<typeof slotConfigSchema>;

export interface Slot {
  start_time: string; // "HH:mm", matches bookings.slot_time
  duration_minutes: number;
}

// ponytail: close must be same-day and after open; cross-midnight sessions are a
// real-edge case we skip — add day-rollover handling if the turf ever runs past 00:00.
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Pick the day's config: per-day override if present, else the default. */
export function getConfigForDate(config: SlotConfig, date: Date): DaySlotConfig {
  return config.days?.[String(date.getDay())] ?? config.default;
}

/**
 * Generate all bookable slot start times for a given date. Slots that cannot
 * fit fully before close are not offered (no partial slots).
 */
export function getSlotsForDate(config: SlotConfig, date: Date): Slot[] {
  const day = getConfigForDate(config, date);
  const openMin = timeToMinutes(day.open);
  const closeMin = timeToMinutes(day.close);

  const slots: Slot[] = [];
  for (let m = openMin; m + day.duration_minutes <= closeMin; m += day.duration_minutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push({ start_time: `${hh}:${mm}`, duration_minutes: day.duration_minutes });
  }
  return slots;
}
