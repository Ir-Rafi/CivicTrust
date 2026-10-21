import assert from "node:assert/strict";
import { test } from "node:test";
import { KPI_MIN_SAMPLE, median, parseSince, pct, percentile, sampleStatus } from "./kpi-math";

test("pct rounds to one decimal and returns null for an empty base", () => {
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(2, 2), 100);
  assert.equal(pct(0, 0), null);
});

test("median handles odd, even and empty lists without mutating the input", () => {
  const xs = [5, 1, 3];
  assert.equal(median(xs), 3);
  assert.deepEqual(xs, [5, 1, 3]);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("percentile uses nearest rank", () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(xs, 90), 9);
  assert.equal(percentile(xs, 100), 10);
  assert.equal(percentile(xs, 0), 1);
  assert.equal(percentile([], 90), null);
});

test("sampleStatus separates no data, early data and measured", () => {
  assert.equal(sampleStatus(0), "none");
  assert.equal(sampleStatus(KPI_MIN_SAMPLE - 1), "early");
  assert.equal(sampleStatus(KPI_MIN_SAMPLE), "measured");
});

test("parseSince accepts only real YYYY-MM-DD dates", () => {
  assert.equal(parseSince("2026-10-25"), "2026-10-25");
  assert.equal(parseSince("2026-02-30"), null);
  assert.equal(parseSince("25-10-2026"), null);
  assert.equal(parseSince(""), null);
  assert.equal(parseSince(undefined), null);
});
