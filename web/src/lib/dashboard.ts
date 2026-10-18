import "server-only";
import type { IssueType } from "@/lib/ai/schemas";
import type { IssueStatus } from "@/lib/issues";
import { signedPhotoUrl } from "@/lib/reports";
import { db } from "@/lib/supabase/server";

// Read-only queries behind the role screens. Writes go through the actions in BACKEND_CONTRACT.md.

export type WorkOrderStatus = "open" | "in_progress" | "submitted" | "approved" | "rejected" | "cancelled";
export type PaymentStatus = "withheld" | "eligible" | "released";
export type Verdict = "approved" | "rejected" | "needs_review";

export type DeadlineBasis = {
  band: string;
  hours: number;
  source: string;
  title: string;
  chunk_id?: number;
  similarity?: number;
} | null;

export type RepairChecks = {
  distance_m?: number;
  distance_passed?: boolean;
  fresh?: boolean;
  after_work_order?: boolean;
  ai?: { same_location: string; issue_resolved: string; confidence: number; reason: string } | null;
  ai_failed?: boolean;
};

export type RepairProof = {
  id: number;
  created_at: string;
  verdict: Verdict;
  verdict_reason_en: string | null;
  distance_m: number;
  checks: RepairChecks;
  officer_decision: "approved" | "rejected" | null;
  officer_reason: string | null;
  photoUrl: string | null;
};

export type WorkOrderDetail = {
  id: number;
  issue_id: number;
  assignee_type: "contractor" | "ngo";
  assignee_name: string | null;
  agreed_cost: number | null;
  deadline: string;
  deadline_basis: DeadlineBasis;
  status: WorkOrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  /** Past the deadline without an approved repair. */
  overdue: boolean;
  proofs: RepairProof[];
};

export async function getPaymentSummary() {
  const [orders, rejected] = await Promise.all([
    db().from("work_orders").select("status, payment_status, agreed_cost").neq("status", "cancelled"),
    db().from("repair_proofs").select("id", { count: "exact", head: true }).eq("verdict", "rejected"),
  ]);
  if (orders.error) throw new Error(`payment summary: ${orders.error.message}`);
  if (rejected.error) throw new Error(`rejected proofs: ${rejected.error.message}`);
  let withheld = 0;
  let released = 0;
  let verified = 0;
  for (const o of orders.data ?? []) {
    const cost = Number(o.agreed_cost ?? 0);
    if (o.payment_status === "released") released += cost;
    else if (o.payment_status === "withheld") withheld += cost;
    if (o.status === "approved") verified += 1;
  }
  return { withheld, released, verified, rejectedProofs: rejected.count ?? 0 };
}

export async function getIssueTotals() {
  const { data, error } = await db().from("issues").select("status, created_at, fixed_at").neq("status", "rejected");
  if (error) throw new Error(`issue totals: ${error.message}`);
  const rows = data ?? [];
  const fixed = rows.filter((r) => r.status === "fixed" || r.status === "confirmed");
  const fixHours = fixed
    .filter((r) => r.fixed_at)
    .map((r) => (new Date(r.fixed_at as string).getTime() - new Date(r.created_at).getTime()) / 3_600_000);
  return {
    total: rows.length,
    open: rows.length - fixed.length,
    fixed: fixed.length,
    avgFixHours: fixHours.length ? fixHours.reduce((a, b) => a + b, 0) / fixHours.length : null,
  };
}

export type Assignee = { id: number; name: string };

export async function listAssignees(): Promise<{ contractors: Assignee[]; ngos: Assignee[] }> {
  const [c, n] = await Promise.all([
    db().from("contractors").select("id, name, company").eq("active", true).order("name"),
    db().from("ngos").select("id, name").eq("active", true).order("name"),
  ]);
  if (c.error) throw new Error(`contractors: ${c.error.message}`);
  if (n.error) throw new Error(`ngos: ${n.error.message}`);
  return {
    contractors: (c.data ?? []).map((r) => ({ id: r.id, name: r.company ? `${r.name} (${r.company})` : r.name })),
    ngos: (n.data ?? []).map((r) => ({ id: r.id, name: r.name })),
  };
}

const ORDER_COLUMNS =
  "id, issue_id, assignee_type, agreed_cost, deadline, deadline_basis, status, payment_status, created_at, contractors(name), ngos(name), repair_proofs(id, created_at, verdict, verdict_reason_en, distance_m, checks, officer_decision, officer_reason, photo_path)";

type OrderRow = Omit<WorkOrderDetail, "assignee_name" | "proofs" | "agreed_cost" | "overdue"> & {
  agreed_cost: number | string | null;
  contractors: { name: string } | null;
  ngos: { name: string } | null;
  repair_proofs: (Omit<RepairProof, "photoUrl"> & { photo_path: string })[];
};

async function hydrateOrder(row: OrderRow): Promise<WorkOrderDetail> {
  const proofs = [...row.repair_proofs].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const { contractors, ngos, repair_proofs: _proofs, ...order } = row;
  void _proofs;
  return {
    ...order,
    agreed_cost: order.agreed_cost === null ? null : Number(order.agreed_cost),
    assignee_name: contractors?.name ?? ngos?.name ?? null,
    overdue: !["approved", "cancelled"].includes(order.status) && new Date(order.deadline).getTime() < Date.now(),
    proofs: await Promise.all(
      proofs.map(async ({ photo_path, ...p }) => ({ ...p, photoUrl: await signedPhotoUrl(photo_path) })),
    ),
  };
}

/** Every work order for one issue, newest first, with its repair proofs. */
export async function listIssueWorkOrders(issueId: number): Promise<WorkOrderDetail[]> {
  const { data, error } = await db()
    .from("work_orders")
    .select(ORDER_COLUMNS)
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`issue work orders: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as OrderRow[]).map(hydrateOrder));
}

export type WorkSite = {
  order: WorkOrderDetail;
  issue: { id: number; issue_type: IssueType; severity: number; status: IssueStatus; road_name: string | null; lat: number; lng: number };
  beforeUrl: string | null;
};

/** One work order as the assigned crew sees it: exact site location and the citizen's "before" photo. */
export async function getWorkSite(workOrderId: number, assignee: { contractorId?: number; ngoId?: number }): Promise<WorkSite | null> {
  let query = db().from("work_orders").select(ORDER_COLUMNS).eq("id", workOrderId);
  if (assignee.contractorId) query = query.eq("contractor_id", assignee.contractorId);
  if (assignee.ngoId) query = query.eq("ngo_id", assignee.ngoId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`work order: ${error.message}`);
  if (!data) return null;
  const order = await hydrateOrder(data as unknown as OrderRow);

  const [issue, before] = await Promise.all([
    db()
      .from("issues")
      .select("id, issue_type, severity, status, road_name, lat:location_lat, lng:location_lng")
      .eq("id", order.issue_id)
      .single(),
    db()
      .from("reports")
      .select("photo_path")
      .eq("issue_id", order.issue_id)
      .order("merged_as_duplicate", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (issue.error || !issue.data) throw new Error(`work site issue: ${issue.error?.message ?? "not found"}`);
  return {
    order,
    issue: issue.data as WorkSite["issue"],
    beforeUrl: before.data ? await signedPhotoUrl(before.data.photo_path) : null,
  };
}

/** Latest approved repair photo for an issue (citizen confirm/dispute screen). */
export async function getApprovedRepair(issueId: number) {
  const orders = await listIssueWorkOrders(issueId);
  const order = orders.find((o) => o.status === "approved" || o.status === "submitted");
  return order ? { order, proof: order.proofs[0] ?? null } : null;
}

export type VolunteerCandidate = {
  id: number;
  issue_type: IssueType;
  severity: number;
  report_count: number;
  road_name: string | null;
  created_at: string;
};

/** Open, unassigned problems community groups can clear without heavy equipment. */
export async function listVolunteerCandidates(): Promise<VolunteerCandidate[]> {
  const { data, error } = await db()
    .from("issues")
    .select("id, issue_type, severity, report_count, road_name, created_at")
    .in("issue_type", ["garbage", "open_drain", "waterlogging"])
    .in("status", ["reported", "verified"])
    .order("severity", { ascending: false })
    .limit(20);
  if (error) throw new Error(`volunteer candidates: ${error.message}`);
  return (data ?? []) as VolunteerCandidate[];
}

export type RecentFix = { id: number; issue_type: IssueType; road_name: string | null; created_at: string; fixed_at: string; status: IssueStatus };

export async function listRecentFixes(limit = 8): Promise<RecentFix[]> {
  const { data, error } = await db()
    .from("issues")
    .select("id, issue_type, road_name, created_at, fixed_at, status")
    .in("status", ["fixed", "confirmed"])
    .not("fixed_at", "is", null)
    .order("fixed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recent fixes: ${error.message}`);
  return (data ?? []) as RecentFix[];
}

export type OrderFlag = "review" | "payable";

/** Issues whose work order needs an officer: a repair to review, or a verified repair to pay. */
export async function listOrderFlags(): Promise<Map<number, OrderFlag>> {
  const { data, error } = await db()
    .from("work_orders")
    .select("issue_id, status, payment_status")
    .or("status.eq.submitted,and(status.eq.approved,payment_status.eq.eligible)");
  if (error) throw new Error(`order flags: ${error.message}`);
  const flags = new Map<number, OrderFlag>();
  for (const o of data ?? []) flags.set(o.issue_id, o.status === "submitted" ? "review" : "payable");
  return flags;
}
