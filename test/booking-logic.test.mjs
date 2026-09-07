// Booking business-logic tests: pricing, slots, status transitions.
// Plain node:test — no framework. Run: node --test test/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateBookingCost,
  getSlotsForDate,
  canTransition,
  allowedTransitions,
  pricingRulesSchema,
  slotConfigSchema,
} from "../packages/shared/src/index.ts";

// --- pricing ---------------------------------------------------------------

const rules = pricingRulesSchema.parse({
  default_price: 1200,
  day_prices: { "5": 1500 }, // Friday dearer
  hour_prices: { "18": 2000 }, // peak hour
});

test("flat rate applies when no day/hour override", () => {
  // Monday 2026-09-07, 10:00
  assert.equal(calculateBookingCost(rules, new Date(2026, 8, 7), "10:00"), 1200);
});

test("day override applies (Friday)", () => {
  // Friday 2026-09-11
  assert.equal(calculateBookingCost(rules, new Date(2026, 8, 11), "10:00"), 1500);
});

test("hour override beats day override (peak Friday evening)", () => {
  assert.equal(calculateBookingCost(rules, new Date(2026, 8, 11), "18:00"), 2000);
});

test("rejects non-positive prices", () => {
  assert.throws(() => pricingRulesSchema.parse({ default_price: 0 }));
});

// --- slots -----------------------------------------------------------------

const config = slotConfigSchema.parse({
  default: { open: "16:00", close: "20:00", duration_minutes: 60 },
  days: { "5": { open: "14:00", close: "20:00", duration_minutes: 90 } }, // Friday
});

test("generates default-day slots", () => {
  const slots = getSlotsForDate(config, new Date(2026, 8, 7)); // Monday
  assert.deepEqual(
    slots.map((s) => s.start_time),
    ["16:00", "17:00", "18:00", "19:00"]
  );
  assert.ok(slots.every((s) => s.duration_minutes === 60));
});

test("per-day override changes slots (Friday 90-min from 14:00)", () => {
  const slots = getSlotsForDate(config, new Date(2026, 8, 11)); // Friday
  assert.deepEqual(
    slots.map((s) => s.start_time),
    ["14:00", "15:30", "17:00", "18:30"] // 18:30 + 90 = 20:00 close, fits exactly
  );
  assert.ok(slots.every((s) => s.duration_minutes === 90));
});

test("no partial slot offered when remainder cannot fit before close", () => {
  // 16:00 close with 60-min slots → last start 19:00 fits; 18:45 close → last 17:00
  const c = slotConfigSchema.parse({
    default: { open: "16:00", close: "18:45", duration_minutes: 60 },
  });
  const slots = getSlotsForDate(c, new Date(2026, 8, 7));
  assert.deepEqual(slots.map((s) => s.start_time), ["16:00", "17:00"]);
});

// --- status transitions ------------------------------------------------------

test("happy path transitions are legal", () => {
  assert.ok(canTransition("pending", "confirmed"));
  assert.ok(canTransition("confirmed", "checked-in"));
  assert.ok(canTransition("checked-in", "completed"));
});

test("skipping stages is illegal", () => {
  assert.ok(!canTransition("pending", "completed"));
  assert.ok(!canTransition("confirmed", "completed"));
  assert.ok(!canTransition("pending", "checked-in"));
});

test("terminal states transition to nothing", () => {
  assert.deepEqual(allowedTransitions("completed"), []);
  assert.deepEqual(allowedTransitions("cancelled"), []);
  assert.deepEqual(allowedTransitions("no_show"), []);
  assert.ok(!canTransition("cancelled", "pending"));
});

test("side-states reachable from any active state", () => {
  assert.ok(canTransition("pending", "cancelled"));
  assert.ok(canTransition("confirmed", "no_show"));
  assert.ok(canTransition("checked-in", "cancelled"));
});
