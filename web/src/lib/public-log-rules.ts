import { NEARBY_FACILITY_M } from "@/lib/geo";
import type { LocationContext } from "@/lib/severity";

// What the public sees of the workflow: where a problem was reported and how far it has got
// (reported → assigned → fixed), plus a plain-language log of those steps. Pure rules, so the
// mapping from internal records to public wording is testable and stays free of personal data.

export type PublicStage = "reported" | "assigned" | "fixed" | "confirmed" | "disputed";

export type PublicEventKind = "reported" | "assigned" | "fixed" | "not_accepted" | "disputed" | "confirmed";

export type Landmark = { kind: "school" | "hospital"; name: string; distance_m: number };

/** Audit actions that can become public events. Everything else (AI scores, payments, overrides) stays internal. */
export const PUBLIC_AUDIT_ACTIONS = [
  "report_submitted",
  "work_order_created",
  "repair_proof_submitted",
  "repair_reviewed",
  "repair_disputed",
  "repair_confirmed",
] as const;

/** Issue status → public stage; null hides the issue (photos rejected as not a civic problem). */
export function publicStage(status: string): PublicStage | null {
  switch (status) {
    case "reported":
    case "verified":
      return "reported";
    case "assigned":
    case "in_progress":
      return "assigned";
    case "fixed":
    case "confirmed":
    case "disputed":
      return status;
    default:
      return null;
  }
}

/** The audit entry as a public event, or null when it is not something the public log shows. */
export function publicEvent(action: string, payload: Record<string, unknown> | null): { kind: PublicEventKind; verifiedBy?: "ai" | "officer" } | null {
  switch (action) {
    case "report_submitted":
      return { kind: "reported" };
    case "work_order_created":
      return { kind: "assigned" };
    case "repair_proof_submitted":
      // Only an approved photo is news; rejected or unsure attempts are crew/officer business.
      return payload?.verdict === "approved" ? { kind: "fixed", verifiedBy: "ai" } : null;
    case "repair_reviewed":
      return payload?.decision === "approved" ? { kind: "fixed", verifiedBy: "officer" } : { kind: "not_accepted" };
    case "repair_disputed":
      return { kind: "disputed" };
    case "repair_confirmed":
      return { kind: "confirmed" };
    default:
      return null;
  }
}

/** Nearest named school or hospital within the policy's "nearby" distance: a place people recognise. */
export function pickLandmark(context: LocationContext | null | undefined): Landmark | null {
  const candidates: Landmark[] = [];
  const school = context?.nearest_school;
  const hospital = context?.nearest_hospital;
  if (school?.name && school.distance_m <= NEARBY_FACILITY_M) candidates.push({ kind: "school", name: school.name, distance_m: school.distance_m });
  if (hospital?.name && hospital.distance_m <= NEARBY_FACILITY_M) candidates.push({ kind: "hospital", name: hospital.name, distance_m: hospital.distance_m });
  candidates.sort((a, b) => a.distance_m - b.distance_m);
  return candidates[0] ?? null;
}
