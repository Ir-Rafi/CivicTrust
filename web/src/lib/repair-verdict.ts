import type { RepairCheck } from "@/lib/ai/schemas";

/** AI confidence needed to approve, or to reject on visual evidence alone. */
export const REPAIR_CONFIDENCE = 0.6;

export type RepairVerdict = "approved" | "rejected" | "needs_review";

export type RepairChecks = {
  fresh: boolean;
  afterWorkOrder: boolean;
  samePlace: boolean;
  /** null when the hard checks failed (AI not called) or the AI call failed. */
  ai: Pick<RepairCheck, "same_location" | "issue_resolved" | "confidence"> | null;
  aiFailed?: boolean;
  /**
   * false when the location was not measured by the device (the contractor's "work site"
   * demo option sends the issue's own coordinates). Default true.
   */
  locationMeasured?: boolean;
};

/**
 * Policy (pilot-sla-policy.md, "Repair verification before closing a job"): a failed hard check (freshness,
 * capture after the work order, ±15 m) rejects; a confident AI "no" rejects; a confident
 * AI "yes" on both questions approves; anything the AI is unsure about goes to an officer.
 */
export function decideRepairVerdict(c: RepairChecks): RepairVerdict {
  if (!c.fresh || !c.afterWorkOrder || !c.samePlace) return "rejected";
  if (!c.ai) return c.aiFailed ? "needs_review" : "rejected";
  const confident = c.ai.confidence >= REPAIR_CONFIDENCE;
  if (confident && (c.ai.same_location === "no" || c.ai.issue_resolved === "no")) return "rejected";
  if (confident && c.ai.same_location === "yes" && c.ai.issue_resolved === "yes") {
    // The 15 m check only means something when the device measured the location. Without that,
    // a passing repair still needs an officer, so payment can never unlock on an unmeasured location.
    return c.locationMeasured === false ? "needs_review" : "approved";
  }
  return "needs_review";
}
