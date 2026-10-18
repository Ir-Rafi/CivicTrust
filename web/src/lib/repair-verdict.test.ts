import assert from "node:assert/strict";
import { test } from "node:test";
import { decideRepairVerdict, type RepairChecks } from "./repair-verdict";

const passed: RepairChecks = {
  fresh: true,
  afterWorkOrder: true,
  samePlace: true,
  ai: { same_location: "yes", issue_resolved: "yes", confidence: 0.9 },
};

test("confident same place + resolved is approved", () => {
  assert.equal(decideRepairVerdict(passed), "approved");
});

test("any failed hard check rejects, whatever the AI says", () => {
  assert.equal(decideRepairVerdict({ ...passed, fresh: false, ai: null }), "rejected");
  assert.equal(decideRepairVerdict({ ...passed, afterWorkOrder: false, ai: null }), "rejected");
  assert.equal(decideRepairVerdict({ ...passed, samePlace: false, ai: null }), "rejected");
});

test("a confident AI 'no' rejects", () => {
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, issue_resolved: "no" } }), "rejected");
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, same_location: "no" } }), "rejected");
});

test("partial, unclear or low-confidence results go to an officer", () => {
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, issue_resolved: "partial" } }), "needs_review");
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, issue_resolved: "unclear" } }), "needs_review");
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, same_location: "unclear" } }), "needs_review");
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, confidence: 0.4 } }), "needs_review");
  assert.equal(decideRepairVerdict({ ...passed, ai: { ...passed.ai!, issue_resolved: "no", confidence: 0.4 } }), "needs_review");
});

test("an AI outage after the hard checks pass goes to an officer, not a rejection", () => {
  assert.equal(decideRepairVerdict({ ...passed, ai: null, aiFailed: true }), "needs_review");
});
