import assert from "node:assert/strict";
import { test } from "node:test";
import { NEARBY_FACILITY_M } from "./geo";
import { pickLandmark, publicEvent, publicStage } from "./public-log-rules";

test("issue statuses map to three public steps plus citizen outcome", () => {
  assert.equal(publicStage("reported"), "reported");
  assert.equal(publicStage("verified"), "reported");
  assert.equal(publicStage("assigned"), "assigned");
  assert.equal(publicStage("in_progress"), "assigned");
  assert.equal(publicStage("fixed"), "fixed");
  assert.equal(publicStage("confirmed"), "confirmed");
  assert.equal(publicStage("disputed"), "disputed");
  assert.equal(publicStage("rejected"), null);
});

test("only approved repairs become 'fixed' events", () => {
  assert.deepEqual(publicEvent("repair_proof_submitted", { verdict: "approved" }), { kind: "fixed", verifiedBy: "ai" });
  assert.equal(publicEvent("repair_proof_submitted", { verdict: "rejected" }), null);
  assert.equal(publicEvent("repair_proof_submitted", { verdict: "needs_review" }), null);
  assert.deepEqual(publicEvent("repair_reviewed", { decision: "approved" }), { kind: "fixed", verifiedBy: "officer" });
  assert.deepEqual(publicEvent("repair_reviewed", { decision: "rejected" }), { kind: "not_accepted" });
});

test("internal actions never reach the public log", () => {
  for (const action of ["issue_assessed", "ai_override", "payment_released", "report_rejected", "report_merged", "work_order_cancelled"]) {
    assert.equal(publicEvent(action, {}), null, action);
  }
});

test("landmark: nearest named facility within the nearby distance", () => {
  const base = { ward: null, road: null };
  assert.deepEqual(
    pickLandmark({ ...base, nearest_school: { name: "A", distance_m: 300 }, nearest_hospital: { name: "B", distance_m: 120 } }),
    { kind: "hospital", name: "B", distance_m: 120 },
  );
  assert.equal(pickLandmark({ ...base, nearest_school: { name: null, distance_m: 50 }, nearest_hospital: null }), null);
  assert.equal(pickLandmark({ ...base, nearest_school: { name: "Far", distance_m: NEARBY_FACILITY_M + 1 }, nearest_hospital: null }), null);
  assert.equal(pickLandmark(null), null);
});
