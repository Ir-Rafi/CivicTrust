import assert from "node:assert/strict";
import { test } from "node:test";
import { DUPLICATE_RADIUS_M, REPAIR_MAX_DISTANCE_M, gpsQuality } from "./geo";

test("GPS quality bands follow the repair tolerance and duplicate radius", () => {
  assert.equal(gpsQuality(5), "good");
  assert.equal(gpsQuality(REPAIR_MAX_DISTANCE_M), "good");
  assert.equal(gpsQuality(REPAIR_MAX_DISTANCE_M + 1), "fair");
  assert.equal(gpsQuality(DUPLICATE_RADIUS_M), "fair");
  assert.equal(gpsQuality(DUPLICATE_RADIUS_M + 1), "poor");
  assert.equal(gpsQuality(168), "poor");
});
