// Match business-logic tests: status transitions, score derivation, side names.
// Plain node:test — no framework. Run: node --test test/
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MATCH_STATUSES,
  MATCH_FORMATS,
  EVENT_TYPES,
  CARD_TYPES,
  canTransitionMatch,
  deriveScore,
  matchDisplayName,
} from "../packages/shared/src/index.ts";

// --- constants --------------------------------------------------------------

test("match formats are the three fixed side-counts", () => {
  assert.deepEqual([...MATCH_FORMATS], ["5-a-side", "7-a-side", "11-a-side"]);
});

test("event types are goal and card only", () => {
  assert.deepEqual([...EVENT_TYPES], ["goal", "card"]);
  assert.deepEqual([...CARD_TYPES], ["yellow", "red"]);
});

// --- status transitions -----------------------------------------------------

test("forward one-step transitions are valid", () => {
  assert.ok(canTransitionMatch("not_started", "first_half"));
  assert.ok(canTransitionMatch("first_half", "half_time"));
  assert.ok(canTransitionMatch("half_time", "second_half"));
  assert.ok(canTransitionMatch("second_half", "full_time"));
});

test("skipping a phase is invalid", () => {
  assert.equal(canTransitionMatch("not_started", "half_time"), false);
  assert.equal(canTransitionMatch("not_started", "full_time"), false);
  assert.equal(canTransitionMatch("first_half", "full_time"), false);
});

test("staying put and going backwards are invalid", () => {
  assert.equal(canTransitionMatch("first_half", "first_half"), false);
  assert.equal(canTransitionMatch("full_time", "second_half"), false);
  assert.equal(canTransitionMatch("full_time", "full_time"), false);
});

test("every status except the last has exactly one successor", () => {
  for (const s of MATCH_STATUSES.slice(0, -1)) {
    const successors = MATCH_STATUSES.filter((t) => canTransitionMatch(s, t));
    assert.equal(successors.length, 1, `${s} should have one successor`);
  }
});

// --- score derivation ------------------------------------------------------

test("goals are counted per side; cards ignored", () => {
  const events = [
    { event_type: "goal", team_id: "a" },
    { event_type: "card", team_id: "a" },
    { event_type: "goal", team_id: "b" },
    { event_type: "goal", team_id: "a" },
    { event_type: "card", team_id: "b" },
  ];
  assert.deepEqual(deriveScore(events, "a", "b"), { team1: 2, team2: 1 });
});

test("events from unrelated teams are not counted", () => {
  const events = [
    { event_type: "goal", team_id: "x" },
    { event_type: "goal", team_id: "b" },
  ];
  assert.deepEqual(deriveScore(events, "a", "b"), { team1: 0, team2: 1 });
});

test("ad-hoc side (null team id) events score nothing for null sides", () => {
  // Ad-hoc sides have no team row — events carry null team_id; with both side
  // ids null the null check would collapse sides, so the helper keeps them
  // separate only when ids differ. Both-null is a degenerate case the UI
  // prevents by always sending the side's team_id when it exists.
  const events = [{ event_type: "goal", team_id: null }];
  assert.deepEqual(deriveScore(events, "a", "b"), { team1: 0, team2: 0 });
});

test("empty events give a nil-nil score", () => {
  assert.deepEqual(deriveScore([], "a", "b"), { team1: 0, team2: 0 });
});

// --- display names ----------------------------------------------------------

test("registered team name wins over ad-hoc", () => {
  assert.equal(matchDisplayName({ name: "Brothers FC", name_adhoc: "casuals" }), "Brothers FC");
});

test("ad-hoc name used when no registered team", () => {
  assert.equal(matchDisplayName({ name: null, name_adhoc: "Sunday casuals" }), "Sunday casuals");
});

test("missing side falls back to TBD", () => {
  assert.equal(matchDisplayName(null), "TBD");
  assert.equal(matchDisplayName({ name: null, name_adhoc: null }), "TBD");
});
