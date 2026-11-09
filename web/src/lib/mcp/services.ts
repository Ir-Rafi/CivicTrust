import "server-only";
import { computeKpis } from "@/lib/kpi";
import { listPublicIssues } from "@/lib/public-log";
import { publicEvent } from "@/lib/public-log-rules";
import { searchPilotPolicy } from "@/lib/policy";
import { deadlineHoursFor } from "@/lib/severity";
import { listContractorScorecards, listIssueHistory, listOfficerQueue, verifyAuditChain } from "@/lib/workflow";
import type { McpServices } from "./contracts";

export const civicTrustServices: McpServices = {
  async list_issues({ area, status, issue_type, min_severity, limit, offset }) {
    const rows = await listOfficerQueue({ area, status, issueType: issue_type, minSeverity: min_severity, limit: limit + 1, offset, excludeRejected: true });
    // The server's output schema removes coordinates, AI internals and other unlisted fields.
    return { issues: rows.slice(0, limit), next_offset: rows.length > limit ? offset + limit : null };
  },
  async get_issue_timeline({ issue_id, limit }) {
    const [issue] = await listPublicIssues(1, issue_id);
    if (!issue) throw new Error("Public issue not found");
    const history = await listIssueHistory(issue_id);
    const events = history.flatMap((row) => {
      const event = publicEvent(row.action, row.payload);
      return event ? [{ id: row.id, at: row.created_at, kind: event.kind, verified_by: event.verifiedBy ?? null }] : [];
    });
    return { issue_id, stage: issue.stage, events: events.slice(-limit), has_more: events.length > limit };
  },
  async search_repair_policy({ query, limit }) {
    return {
      policy_status: "Team-authored pilot policy; not an official city regulation.",
      matches: await searchPilotPolicy(query, limit),
      deadline_rules: [[1, 2], [3, 4], [5, 7], [8, 10]].map(([minimum_severity, maximum_severity]) => ({
        minimum_severity, maximum_severity, ...deadlineHoursFor(minimum_severity),
      })),
    };
  },
  async get_contractor_scorecards({ limit, offset }) {
    const rows = await listContractorScorecards();
    return { contractors: rows.slice(offset, offset + limit), next_offset: rows.length > offset + limit ? offset + limit : null };
  },
  async get_impact_summary() {
    const k = await computeKpis(null);
    return {
      scope: "all_time", counts: k.counts, triage_ms: k.triageMs, duplicate_merge: k.duplicateMerge,
      payments_backed: k.paymentsBacked, audit_completion: k.auditCompletion, photo_analysis: k.photoAnalysis,
      limitations: [
        "All-time prototype records, including demo/testing activity. No date filter is applied.",
        "Sample sizes accompany rates; fewer than 10 observations are early data. Sample size alone does not establish representative accuracy.",
        "Photo-analysis success measures completed responses, not classification accuracy.",
        "Payment release records a status, not a bank transfer. Real repair quality, financial savings and citizen impact are unmeasured.",
      ],
    };
  },
  async verify_audit_chain() {
    const result = await verifyAuditChain();
    return { ...result, status: result.first_broken_id !== null ? "broken" : result.total === 0 ? "empty" : "valid",
      limitation: "Checks integrity of recorded entries, not completeness of all workflow actions or truth of repair evidence." };
  },
};
