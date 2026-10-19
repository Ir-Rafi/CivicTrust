import assert from "node:assert/strict";
import { test } from "node:test";
import { DUPLICATE_RADIUS_M, REPAIR_MAX_DISTANCE_M, googleMapsUrl, gpsQuality, insidePilot, PILOT_BOUNDS, PILOT_CENTER } from "./geo";

test("GPS quality bands follow the repair tolerance and duplicate radius", () => {
  assert.equal(gpsQuality(5), "good");
  assert.equal(gpsQuality(REPAIR_MAX_DISTANCE_M), "good");
  assert.equal(gpsQuality(REPAIR_MAX_DISTANCE_M + 1), "fair");
  assert.equal(gpsQuality(DUPLICATE_RADIUS_M), "fair");
  assert.equal(gpsQuality(DUPLICATE_RADIUS_M + 1), "poor");
  assert.equal(gpsQuality(168), "poor");
});

test("Google Maps link carries the exact point", () => {
  assert.equal(googleMapsUrl(23.4800123, 91.1230456), "https://www.google.com/maps/search/?api=1&query=23.480012%2C91.123046");
});

test("pilot area check", () => {
  assert.equal(insidePilot(...PILOT_CENTER), true);
  assert.equal(insidePilot(PILOT_BOUNDS.south, PILOT_BOUNDS.west), true);
  assert.equal(insidePilot(23.48, 91.12), false); // Cumilla
  assert.equal(insidePilot(PILOT_BOUNDS.north + 0.001, PILOT_CENTER[1]), false);
});
