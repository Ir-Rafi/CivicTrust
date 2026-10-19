import assert from "node:assert/strict";
import { test } from "node:test";
import { placeLines, toPlaceName } from "./place-name";

// Real Nominatim reverse-geocoding responses (address part) for spots in Dhaka.
const road16Bn = {
  amenity: "هرفي",
  house_number: "38/2",
  road: "রোড ১৬",
  residential: "ধানমন্ডি আবাসিক এলাকা",
  quarter: "বাঁশবাড়ি",
  suburb: "লালমাটিয়া",
  county: "ঢাকা মহানগর",
  state_district: "ঢাকা জেলা",
  state: "ঢাকা বিভাগ",
  country: "বাংলাদেশ",
};
const laneNoRoadEn = {
  residential: "Dhanmondi Residential Area",
  suburb: "Lalmatia",
  county: "Dhaka Metropolitan",
  state: "Dhaka Division",
  country: "Bangladesh",
};
const gulshanEn = {
  building: "Kabir Kunj",
  house_number: "House: 14",
  road: "Road 17/A",
  quarter: "Gulshan 2",
  suburb: "Gulshan",
  city: "Dhaka",
  county: "Dhaka Metropolitan",
  country: "Bangladesh",
};

test("road, area and city in Bangla; shop names in other scripts are left out", () => {
  const name = toPlaceName(road16Bn);
  assert.deepEqual(name, { road: "রোড ১৬", houseNumber: "38/2", area: ["বাঁশবাড়ি", "লালমাটিয়া"], city: "ঢাকা মহানগর" });
  assert.deepEqual(placeLines(name, { includeHouse: false }), { primary: "রোড ১৬", secondary: "বাঁশবাড়ি, লালমাটিয়া, ঢাকা মহানগর" });
  assert.ok(!JSON.stringify(placeLines(name, { includeHouse: true })).includes("هرفي"));
});

test("house number only when the fix is precise", () => {
  const name = toPlaceName(gulshanEn);
  assert.equal(placeLines(name, { includeHouse: true }).primary, "House: 14, Road 17/A");
  assert.equal(placeLines(name, { includeHouse: false }).primary, "Road 17/A");
  assert.equal(placeLines(name, { includeHouse: false }).secondary, "Gulshan 2, Gulshan, Dhaka");
});

test("no road: area and city still name the place", () => {
  const name = toPlaceName(laneNoRoadEn);
  assert.deepEqual(placeLines(name, { includeHouse: true }), {
    primary: null,
    secondary: "Lalmatia, Dhanmondi Residential Area, Dhaka Metropolitan",
  });
});

test("nothing usable gives null", () => {
  assert.equal(toPlaceName(null), null);
  assert.equal(toPlaceName({ country: "Bangladesh", state: "Dhaka Division" }), null);
  assert.deepEqual(placeLines(null, { includeHouse: true }), { primary: null, secondary: null });
});
