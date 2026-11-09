import { z } from "zod";

const id = z.number().int().positive();
const count = z.number().int().nonnegative();
const nullableText = z.string().nullable();
const percentage = z.number().min(0).max(100).nullable();
const issueType = z.enum(["pothole", "road_crack", "garbage", "open_drain", "waterlogging", "other"]);
const status = z.enum(["reported", "verified", "assigned", "in_progress", "fixed", "confirmed", "disputed"]);

export const inputs = {
  list_issues: z.object({
    area: z.string().trim().min(1).max(100).optional().describe("Exact English OpenStreetMap area name, e.g. Lalmatia. Omit to include all pilot areas."),
    status: status.optional(),
    issue_type: issueType.optional(),
    min_severity: z.number().int().min(1).max(10).optional(),
    limit: z.number().int().min(1).max(25).default(10),
    offset: z.number().int().min(0).max(10000).default(0),
  }).strict(),
  get_issue_timeline: z.object({ issue_id: id, limit: z.number().int().min(1).max(50).default(20) }).strict(),
  search_repair_policy: z.object({ query: z.string().trim().min(3).max(500), limit: z.number().int().min(1).max(5).default(3) }).strict(),
  get_contractor_scorecards: z.object({ limit: z.number().int().min(1).max(25).default(10), offset: z.number().int().min(0).max(10000).default(0) }).strict(),
  // All-time only: date-filtered parent/event cohorts need separate reconciliation.
  get_impact_summary: z.object({}).strict(),
  verify_audit_chain: z.object({}).strict(),
};

// Output schemas are also privacy allowlists: unknown fields are stripped at every object boundary.
export const outputs = {
  list_issues: z.object({
    issues: z.array(z.object({ id, issue_type: issueType, status, severity: z.number().min(1).max(10), road_name: nullableText,
      area_en: nullableText, area_bn: nullableText, report_count: count, created_at: z.string() })).max(25),
    next_offset: count.nullable(),
  }),
  get_issue_timeline: z.object({
    issue_id: id,
    stage: z.enum(["reported", "assigned", "fixed", "confirmed", "disputed"]),
    events: z.array(z.object({ id, at: z.string(), kind: z.enum(["reported", "assigned", "fixed", "not_accepted", "disputed", "confirmed"]),
      verified_by: z.enum(["ai", "officer"]).nullable() })).max(50),
    has_more: z.boolean(),
  }),
  search_repair_policy: z.object({
    policy_status: z.literal("Team-authored pilot policy; not an official city regulation."),
    matches: z.array(z.object({ id, source: z.string(), title: z.string(), content: z.string().max(12000), similarity: z.number() })).max(5),
    deadline_rules: z.array(z.object({ minimum_severity: z.number(), maximum_severity: z.number(), hours: z.number(), band: z.string() })),
  }),
  get_contractor_scorecards: z.object({
    contractors: z.array(z.object({ contractor_id: id, contractor_name: z.string(), company: nullableText,
      assigned_count: count, approved_count: count, rejected_count: count, disputed_count: count, on_time_count: count, on_time_rate: percentage })).max(25),
    next_offset: count.nullable(),
  }),
  get_impact_summary: z.object({
    scope: z.literal("all_time"),
    counts: z.object({ issues: count, reports: count, workOrders: count, repairProofs: count, feedback: count }),
    triage_ms: z.object({ n: count, median: z.number().nullable(), p90: z.number().nullable() }),
    duplicate_merge: z.object({ merged: count, of: count, pct: percentage }),
    payments_backed: z.object({ backed: count, of: count, pct: percentage }),
    audit_completion: z.object({ recorded: count, of: count, pct: percentage }),
    photo_analysis: z.object({ ok: count, failed: count, of: count, pct: percentage }),
    limitations: z.array(z.string()),
  }),
  verify_audit_chain: z.object({ total: count, first_broken_id: id.nullable(), status: z.enum(["valid", "broken", "empty"]), limitation: z.string() }),
};

export type ToolName = keyof typeof inputs;
export type McpServices = { [K in ToolName]: (args: z.output<(typeof inputs)[K]>) => Promise<unknown> };
