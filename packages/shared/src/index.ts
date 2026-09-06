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
