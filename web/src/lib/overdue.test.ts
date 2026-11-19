import assert from "node:assert/strict";
import { test } from "node:test";
import { hoursLate, isOverdue, newlyOverdue } from "./overdue";

const now = new Date("2026-11-19T06:00:00Z").getTime();
const past = "2026-11-18T03:30:00Z"; // 26.5 h before now
const future = "2026-11-20T00:00:00Z";

test("an order is overdue only after its deadline and until the repair is approved or cancelled", () => {
  for (const status of ["open", "in_progress", "submitted", "rejected"]) assert.equal(isOverdue({ status, deadline: past }, now), true, status);
  for (const status of ["approved", "cancelled"]) assert.equal(isOverdue({ status, deadline: past }, now), false, status);
  assert.equal(isOverdue({ status: "open", deadline: future }, now), false);
  assert.equal(isOverdue({ status: "open", deadline: new Date(now).toISOString() }, now), false, "not yet late at the deadline itself");
});

test("hoursLate counts whole hours and never goes negative", () => {
  assert.equal(hoursLate(past, now), 26);
  assert.equal(hoursLate(future, now), 0);
});

test("the daily check records each overdue order once", () => {
  const orders = [
    { id: 1, status: "open", deadline: past },
    { id: 2, status: "in_progress", deadline: past },
    { id: 3, status: "approved", deadline: past },
    { id: 4, status: "open", deadline: future },
  ];
  assert.deepEqual(newlyOverdue(orders, new Set(), now).map((o) => o.id), [1, 2]);
  assert.deepEqual(newlyOverdue(orders, new Set([1]), now).map((o) => o.id), [2], "order 1 was recorded on an earlier run");
  assert.deepEqual(newlyOverdue(orders, new Set([1, 2]), now), []);
});
