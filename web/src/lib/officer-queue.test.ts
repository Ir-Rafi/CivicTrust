import assert from "node:assert/strict";
import { test } from "node:test";
import { applyQueueFilters, officerQueueHref, readQueueSelection } from "./officer-queue";
import type { OrderFlag } from "./dashboard";
import type { OfficerQueueItem } from "./workflow";

type Row = Pick<OfficerQueueItem, "id" | "status" | "severity" | "issue_type" | "area_en">;
const rows: Row[] = [
  { id: 1, status: "reported", severity: 9, issue_type: "pothole", area_en: "Lalmatia" },
  { id: 2, status: "verified", severity: 7, issue_type: "garbage", area_en: "Lalmatia" },
  { id: 3, status: "assigned", severity: 8, issue_type: "pothole", area_en: "Dhanmondi" },
  { id: 4, status: "fixed", severity: 10, issue_type: "pothole", area_en: "Lalmatia" },
  { id: 5, status: "confirmed", severity: 9, issue_type: "garbage", area_en: "Dhanmondi" },
  { id: 6, status: "rejected", severity: 8, issue_type: "pothole", area_en: null },
  { id: 7, status: "fixed", severity: 6, issue_type: "garbage", area_en: "Lalmatia" },
];
const flags: ReadonlyMap<number, OrderFlag> = new Map([
  [3, "review"],
  [4, "payable"],
]);
const ids = (result: Row[]) => result.map((row) => row.id);

test("queue statuses retain actionable repairs in open and exclude closed issues from critical", () => {
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "open" }, flags)), [1, 2, 3, 4]);
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "new" }, flags)), [1, 2]);
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "critical" }, flags)), [1, 3]);
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "action" }, flags)), [3, 4]);
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "all" }, flags)), [1, 2, 3, 4, 5, 6, 7]);
});

test("status, type and area filters combine without changing queue order or source rows", () => {
  const original = structuredClone(rows);
  const result = applyQueueFilters(rows, { filter: "open", type: "pothole", area: "Lalmatia" }, flags);
  assert.deepEqual(ids(result), [1, 4]);
  assert.equal(result[0], rows[0]);
  assert.deepEqual(rows, original);
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "new", type: "pothole", area: "Dhanmondi" }, flags)), []);
  assert.deepEqual(ids(applyQueueFilters(rows, { filter: "all", type: "garbage", area: "Lalmatia" }, flags)), [2, 7]);
});

test("queue selection accepts valid URL values and defaults invalid filters", () => {
  assert.deepEqual(readQueueSelection(new URLSearchParams("f=action&type=garbage&area=Lalmatia&issue=4")), {
    filter: "action",
    type: "garbage",
    area: "Lalmatia",
    selectedId: 4,
  });
  assert.deepEqual(readQueueSelection(new URLSearchParams("f=unknown&type=bad&area=+")), {
    filter: "open",
    type: undefined,
    area: undefined,
    selectedId: null,
  });
  for (const issue of ["", "0", "-1", "1.5", "Infinity", "1e2", "2garbage", "9007199254740992"]) {
    assert.equal(readQueueSelection(new URLSearchParams({ issue })).selectedId, null, `invalid issue: ${issue}`);
  }
});

test("queue URLs preserve other filters and reset selected issue explicitly", () => {
  const current = readQueueSelection(new URLSearchParams("f=critical&type=pothole&area=West+Dhanmondi&issue=3"));
  assert.equal(officerQueueHref(current, { f: "all", issue: null }), "/officer?f=all&type=pothole&area=West+Dhanmondi");
  assert.equal(officerQueueHref(current, { issue: 4 }), "/officer?f=critical&type=pothole&area=West+Dhanmondi&issue=4");
  assert.equal(officerQueueHref(current, { type: null, area: null }), "/officer?f=critical&issue=3");
  assert.equal(officerQueueHref(current, { f: "open", type: null, area: null, issue: null }), "/officer");
  const changed = officerQueueHref(current, { area: "Lalmatia", issue: null });
  assert.deepEqual(readQueueSelection(new URL(changed, "http://localhost").searchParams), {
    filter: "critical",
    type: "pothole",
    area: "Lalmatia",
    selectedId: null,
  });
});
