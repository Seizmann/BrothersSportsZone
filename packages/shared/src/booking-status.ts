import type { BookingStatus } from "./index.ts";

// Booking status lifecycle (REQUIREMENT.md §4.2):
//   pending → confirmed → checked-in → completed
// plus two terminal side-states reachable from any active state:
//   cancelled (customer/admin cancel) and no_show.
// Terminal states are terminal — nothing leaves completed/cancelled/no_show.

const ACTIVE_PATH: Record<Exclude<BookingStatus, "cancelled" | "no_show">, BookingStatus[]> = {
  pending: ["confirmed", "cancelled", "no_show"],
  confirmed: ["checked-in", "cancelled", "no_show"],
  "checked-in": ["completed", "cancelled", "no_show"],
  completed: [],
};

/** All valid transitions from any status (terminal states transition to nothing). */
export function allowedTransitions(from: BookingStatus): BookingStatus[] {
  return ACTIVE_PATH[from as keyof typeof ACTIVE_PATH] ?? [];
}

/** Whether a status change is legal. Guards every booking status update. */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return allowedTransitions(from).includes(to);
}
