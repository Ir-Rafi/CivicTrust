import assert from "node:assert/strict";
import { test } from "node:test";
import { createBudget } from "./time-budget";

test("each step gets its cap while plenty of time is left", () => {
  let t = 0;
  const budget = createBudget(50_000, () => t);
  assert.equal(budget.timeoutFor(30_000), 30_000);
  t = 10_000;
  assert.equal(budget.elapsed(), 10_000);
  assert.equal(budget.remaining(), 40_000);
});

test("late steps are squeezed to what is left, keeping the reserve", () => {
  let t = 0;
  const budget = createBudget(50_000, () => t);
  t = 35_000;
  assert.equal(budget.timeoutFor(12_000, 8_000), 7_000);
  t = 45_000;
  assert.equal(budget.timeoutFor(12_000, 8_000), 0);
  assert.equal(budget.timeoutFor(10_000), 5_000);
});

test("never negative after the budget is spent", () => {
  let t = 0;
  const budget = createBudget(1_000, () => t);
  t = 5_000;
  assert.equal(budget.remaining(), 0);
  assert.equal(budget.timeoutFor(10_000), 0);
});
