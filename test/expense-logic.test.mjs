// Expense constant tests: EXPENSE_CATEGORIES lives in packages/shared so the
// admin form and future reporting group identically. Plain node:test.
import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPENSE_CATEGORIES } from "../packages/shared/src/index.ts";

test("EXPENSE_CATEGORIES is a non-empty array", () => {
  assert.ok(Array.isArray(EXPENSE_CATEGORIES));
  assert.ok(EXPENSE_CATEGORIES.length > 0);
});

test("every category is a unique non-empty string", () => {
  const seen = new Set();
  for (const c of EXPENSE_CATEGORIES) {
    assert.equal(typeof c, "string");
    assert.ok(c.length > 0);
    assert.ok(!seen.has(c), `duplicate category: ${c}`);
    seen.add(c);
  }
});

test("catch-all category exists", () => {
  assert.ok(EXPENSE_CATEGORIES.includes("other"));
});
