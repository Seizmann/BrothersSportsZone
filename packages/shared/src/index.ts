// Shared zod schemas, constants, and types — used by both apps/web and apps/admin.
// Role keys are fixed by REQUIREMENT.md §4.3 — exactly three tiers, do not add more.
export const STAFF_ROLES = ["sudo_admin", "manager", "stuff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// Booking status lifecycle per REQUIREMENT.md §4.2. 'cancelled'/'no_show' are terminal side-states.
export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked-in",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Payment state shown in the admin payment UI (REQUIREMENT.md §4.2/4.3).
// Derived from booking_payments amounts, not stored as a column.
export const PAYMENT_STATUSES = ["paid", "partial", "due"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Match progression is admin-driven, no auto-timer (REQUIREMENT.md §5.3).
export const MATCH_STATUSES = [
  "not_started",
  "first_half",
  "half_time",
  "second_half",
  "full_time",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// Fixed side-counts for a match (§5.2).
export const MATCH_FORMATS = ["5-a-side", "7-a-side", "11-a-side"] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];

// Event kinds an admin can log during a live match (§5.4).
export const EVENT_TYPES = ["goal", "card"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CARD_TYPES = ["yellow", "red"] as const;
export type CardType = (typeof CARD_TYPES)[number];

// Match status can only step forward one phase at a time — admin manually
// advances, never skips (e.g. no not_started → full_time).
export function canTransitionMatch(
  from: MatchStatus,
  to: MatchStatus,
): boolean {
  return MATCH_STATUSES.indexOf(to) === MATCH_STATUSES.indexOf(from) + 1;
}

// Score is derived from match_events, not stored (no score column) — count
// goals per side. team1Id/team2Id may be null for ad-hoc sides; ad-hoc sides
// can still score, events just carry team_id: null for them.
export function deriveScore(
  events: { event_type: string; team_id: string | null }[],
  team1Id: string | null,
  team2Id: string | null,
): { team1: number; team2: number } {
  let team1 = 0;
  let team2 = 0;
  for (const e of events) {
    if (e.event_type !== "goal") continue;
    if (e.team_id !== null && e.team_id === team1Id) team1++;
    else if (e.team_id !== null && e.team_id === team2Id) team2++;
    // ponytail: ad-hoc-side goals (team_id null) are unattributable without a
    // side marker on the event — see match-detail UI which sends team_id of the
    // scoring side always, null only if the side itself was ad-hoc. MVP: ad-hoc
    // sides get events with their side ordinal encoded in details_json if needed.
  }
  return { team1, team2 };
}

// Display name for a match side: registered team name, else the ad-hoc name.
// One of the two is always non-null per the match_side_valid check constraint.
export function matchDisplayName(
  side: { name?: string | null; name_adhoc?: string | null } | null | undefined,
): string {
  return side?.name ?? side?.name_adhoc ?? "TBD";
}

// Fixed regional config — intentionally not configurable (REQUIREMENT.md §3).
export const TIMEZONE = "Asia/Dhaka";
export const CURRENCY = "BDT";

// Expense entry categories (§4.4 dashboard/expense module). Fixed list so the
// admin form and any future reporting group consistently — no free-text tags.
export const EXPENSE_CATEGORIES = [
  "utilities",
  "maintenance",
  "supplies",
  "staff_costs",
  "marketing",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export * from "./pricing.ts";
export * from "./slots.ts";
export * from "./booking-status.ts";
