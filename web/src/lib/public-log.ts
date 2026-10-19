import "server-only";
import type { IssueType } from "@/lib/ai/schemas";
import {
  PUBLIC_AUDIT_ACTIONS,
  pickLandmark,
  publicEvent,
  publicStage,
  type Landmark,
  type PublicEventKind,
  type PublicStage,
} from "@/lib/public-log-rules";
import type { LocationContext } from "@/lib/severity";
import { db } from "@/lib/supabase/server";

// Public view of the workflow. Returns only: issue type, road name, nearest named landmark,
// stage and dates. Never coordinates, reporter names, comments, costs or AI internals.

export type PublicPlace = { road: string | null; landmark: Landmark | null };

export type PublicIssue = {
  id: number;
  issue_type: IssueType;
  place: PublicPlace;
  stage: PublicStage;
  report_count: number;
  reported_at: string;
  assigned_at: string | null;
  fixed_at: string | null;
};

export type PublicEvent = {
  /** Audit-log record id, so a line can be matched to its permanent record on the audit page. */
  id: number;
  at: string;
  kind: PublicEventKind;
  verified_by: "ai" | "officer" | null;
  issue: { id: number; issue_type: IssueType; place: PublicPlace };
};

type IssueRow = {
  id: number;
  issue_type: IssueType;
  status: string;
  road_name: string | null;
  report_count: number;
  created_at: string;
  fixed_at: string | null;
  severity_components: { context?: LocationContext } | null;
  work_orders: { created_at: string; status: string }[];
};

const ISSUE_COLUMNS = "id, issue_type, status, road_name, report_count, created_at, fixed_at, severity_components, work_orders(created_at, status)";

function placeOf(row: Pick<IssueRow, "road_name" | "severity_components">): PublicPlace {
  return { road: row.road_name, landmark: pickLandmark(row.severity_components?.context) };
}

/** Every public issue, newest first, with how far it has got. */
export async function listPublicIssues(limit = 50): Promise<PublicIssue[]> {
  const { data, error } = await db()
    .from("issues")
    .select(ISSUE_COLUMNS)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`public issues: ${error.message}`);
  return ((data ?? []) as unknown as IssueRow[]).flatMap((row) => {
    const stage = publicStage(row.status);
    if (!stage) return [];
    const assigned = row.work_orders
      .filter((w) => w.status !== "cancelled")
      .map((w) => w.created_at)
      .sort()
      .at(-1);
    return [{
      id: row.id,
      issue_type: row.issue_type,
      place: placeOf(row),
      stage,
      report_count: row.report_count,
      reported_at: row.created_at,
      assigned_at: stage === "reported" ? null : assigned ?? null,
      fixed_at: ["fixed", "confirmed", "disputed"].includes(stage) ? row.fixed_at : null,
    }];
  });
}

type AuditRow = { id: number; created_at: string; action: string; entity: string; entity_id: number | null; payload: Record<string, unknown> | null };

/** Plain-language log of public steps, newest first, written from the hash-chained audit log. */
export async function listPublicLog(limit = 40): Promise<PublicEvent[]> {
  // Rejected or unsure repair attempts are filtered out after the query, so read some extra rows.
  const { data, error } = await db()
    .from("audit_log")
    .select("id, created_at, action, entity, entity_id, payload")
    .in("action", [...PUBLIC_AUDIT_ACTIONS])
    .order("id", { ascending: false })
    .limit(limit * 3);
  if (error) throw new Error(`public log: ${error.message}`);
  const rows = ((data ?? []) as AuditRow[])
    .map((row) => ({ row, event: publicEvent(row.action, row.payload) }))
    .filter((r): r is { row: AuditRow; event: NonNullable<ReturnType<typeof publicEvent>> } => r.event !== null)
    .slice(0, limit);

  // Work-order events carry the issue id in the payload, except repair proofs: look those up.
  const proofOrderIds = rows.filter((r) => r.row.action === "repair_proof_submitted" && r.row.entity_id).map((r) => r.row.entity_id as number);
  const orderIssue = new Map<number, number>();
  if (proofOrderIds.length) {
    const { data: orders, error: orderError } = await db().from("work_orders").select("id, issue_id").in("id", proofOrderIds);
    if (orderError) throw new Error(`public log work orders: ${orderError.message}`);
    for (const o of orders ?? []) orderIssue.set(o.id, o.issue_id);
  }
  const issueIdOf = ({ row }: (typeof rows)[number]): number | null => {
    if (row.entity === "issue") return row.entity_id;
    if (typeof row.payload?.issue_id === "number") return row.payload.issue_id;
    return row.entity_id ? orderIssue.get(row.entity_id) ?? null : null;
  };

  const issueIds = [...new Set(rows.map(issueIdOf).filter((id): id is number => id !== null))];
  const issues = new Map<number, IssueRow>();
  if (issueIds.length) {
    const { data: found, error: issueError } = await db().from("issues").select(ISSUE_COLUMNS).in("id", issueIds).neq("status", "rejected");
    if (issueError) throw new Error(`public log issues: ${issueError.message}`);
    for (const i of (found ?? []) as unknown as IssueRow[]) issues.set(i.id, i);
  }

  // Entries for deleted issues (removed test data) have nothing public to show, so they drop out.
  return rows.flatMap((r) => {
    const issueId = issueIdOf(r);
    const issue = issueId === null ? undefined : issues.get(issueId);
    if (!issue) return [];
    return [{
      id: r.row.id,
      at: r.row.created_at,
      kind: r.event.kind,
      verified_by: r.event.verifiedBy ?? null,
      issue: { id: issue.id, issue_type: issue.issue_type, place: placeOf(issue) },
    }];
  });
}
