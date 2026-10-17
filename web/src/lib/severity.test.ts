import assert from "node:assert/strict";
import { test } from "node:test";
import { computeSeverity, deadlineHoursFor, type LocationContext } from "./severity";

const emptyContext: LocationContext = { ward: null, road: null, nearest_school: null, nearest_hospital: null };

test("severe pothole on a primary road next to a school scores high", () => {
  const r = computeSeverity({
    visualClass: "severe",
    context: {
      ...emptyContext,
      road: { highway: "primary", name: "Satmasjid Road", distance_m: 3 },
      nearest_school: { name: "A school", distance_m: 150 },
    },
    reportCount: 1,
    daysOpen: 0,
  });
  assert.equal(r.raw, 9.5); // 6 + 2 + 1.5
  assert.equal(r.score, 10);
  assert.deepEqual(
    r.components.map((c) => c.key),
    ["visual", "road", "proximity", "reports", "age"],
  );
});

test("minor issue on a quiet lane stays low", () => {
  const r = computeSeverity({ visualClass: "minor", context: emptyContext, reportCount: 1, daysOpen: 0 });
  assert.equal(r.score, 2);
});

test("extra reports are capped so volume cannot dominate", () => {
  const few = computeSeverity({ visualClass: "moderate", context: emptyContext, reportCount: 3, daysOpen: 0 });
  const many = computeSeverity({ visualClass: "moderate", context: emptyContext, reportCount: 200, daysOpen: 0 });
  assert.equal(few.raw, many.raw);
  assert.equal(many.components.find((c) => c.key === "reports")!.points, 1);
});

test("nearest sensitive site wins when both school and hospital are close", () => {
  const r = computeSeverity({
    visualClass: "moderate",
    context: {
      ...emptyContext,
      nearest_school: { name: null, distance_m: 450 },
      nearest_hospital: { name: null, distance_m: 120 },
    },
    reportCount: 1,
    daysOpen: 0,
  });
  const proximity = r.components.find((c) => c.key === "proximity")!;
  assert.equal(proximity.points, 1.5);
  assert.match(proximity.detail, /hospital/);
});

test("Bangla details use Bangla digits and road terms", () => {
  const r = computeSeverity({
    visualClass: "moderate",
    context: {
      ...emptyContext,
      road: { highway: "residential", name: null, distance_m: 1 },
      nearest_school: { name: "Academia", distance_m: 61 },
    },
    reportCount: 1,
    daysOpen: 0,
  });
  assert.equal(r.components.find((c) => c.key === "road")!.detailBn, "আবাসিক রাস্তা");
  assert.equal(r.components.find((c) => c.key === "proximity")!.detailBn, "স্কুল থেকে ৬১ মিটার দূরে");
});

test("deadline bands match the pilot policy", () => {
  assert.equal(deadlineHoursFor(9).hours, 48);
  assert.equal(deadlineHoursFor(5).hours, 168);
  assert.equal(deadlineHoursFor(3).hours, 336);
  assert.equal(deadlineHoursFor(1).hours, 720);
});
