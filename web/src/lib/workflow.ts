import "server-only";

import { z } from "zod";
import { verifyRepairPhotos, type ImageInput } from "@/lib/ai/gemini";
import { embedText } from "@/lib/ai/gemini";
import { audit } from "@/lib/audit";
import { MAX_PHOTO_AGE_MINUTES, REPAIR_MAX_DISTANCE_M } from "@/lib/geo";
import { deadlineHoursFor } from "@/lib/severity";
import type { IssueType, VisualClass } from "@/lib/ai/schemas";
import { db, PHOTO_BUCKET, pointWkt } from "@/lib/supabase/server";
import { signedPhotoUrl } from "@/lib/reports";

const MAX_REPAIR_BYTES = 4 * 1024 * 1024;
const REPAIR_CONFIDENCE = 0.6;

export type QueueFilters = {
  status?: string;
  issueType?: IssueType;
  wardId?: number;
  limit?: number;
};

export type OfficerQueueItem = {
  id: number;
  issue_type: IssueType;
  visual_class: VisualClass;
  severity: number;
  severity_components: unknown;
  ai_confidence: number | null;
  ai_reason_en: string | null;
  ai_reason_bn: string | null;
  status: string;
  report_count: number;
  ward_id: number | null;
  road_name: string | null;
  created_at: string;
};

export async function listOfficerQueue(filters: QueueFilters = {}): Promise<OfficerQueueItem[]> {
  let query = db()
    .from("issues")
    .select(
      "id, issue_type, visual_class, severity, severity_components, ai_confidence, ai_reason_en, ai_reason_bn, status, report_count, ward_id, road_name, created_at",
    )
    .order("severity", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(filters.limit ?? 100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.issueType) query = query.eq("issue_type", filters.issueType);
  if (filters.wardId) query = query.eq("ward_id", filters.wardId);
  const { data, error } = await query;
  if (error) throw new Error(`listOfficerQueue: ${error.message}`);
  return (data ?? []) as OfficerQueueItem[];
}

const overrideSchema = z.object({
  issueId: z.number().int().positive(),
  actorName: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(3).max(1000),
  issueType: z.enum(["pothole", "road_crack", "garbage", "open_drain", "waterlogging", "other"]).optional(),
  visualClass: z.enum(["minor", "moderate", "severe"]).optional(),
  severity: z.number().int().min(1).max(10).optional(),
});

export async function overrideIssue(input: z.input<typeof overrideSchema>) {
  const values = overrideSchema.parse(input);
  if (values.issueType === undefined && values.visualClass === undefined && values.severity === undefined) {
    throw new Error("At least one AI field must be corrected");
  }
  const { data: issue, error: loadError } = await db()
    .from("issues")
    .select("id, issue_type, visual_class, severity, ai_override")
    .eq("id", values.issueId)
    .single();
  if (loadError || !issue) throw new Error(`load issue: ${loadError?.message ?? "not found"}`);

  const next = {
    issue_type: values.issueType ?? issue.issue_type,
    visual_class: values.visualClass ?? issue.visual_class,
    severity: values.severity ?? issue.severity,
  };
  const override = {
    by: values.actorName,
    from: { issue_type: issue.issue_type, visual_class: issue.visual_class, severity: issue.severity },
    to: next,
    reason: values.reason,
    at: new Date().toISOString(),
  };
  const { error } = await db()
    .from("issues")
    .update({
      issue_type: next.issue_type,
      visual_class: next.visual_class,
      severity: next.severity,
      ai_override: override,
    })
    .eq("id", values.issueId);
  if (error) throw new Error(`override issue: ${error.message}`);
  await audit({
    actorRole: "officer",
    actorName: values.actorName,
    action: "ai_override",
    entity: "issue",
    entityId: values.issueId,
    payload: override,
  });
  return { issueId: values.issueId, ...next };
}

async function deadlineBasis(severity: number) {
  const local = deadlineHoursFor(severity);
  try {
    const query = `repair deadline for severity ${severity} (${local.band})`;
    const embedding = await embedText(query, "query");
    const { data, error } = await db().rpc("match_policy_chunks", {
      query_embedding: JSON.stringify(embedding),
      match_count: 1,
    });
    if (!error && data?.[0]) {
      const match = data[0] as { id: number; source: string; title: string; content: string; similarity: number };
      return {
        band: local.band,
        hours: local.hours,
        source: match.source,
        title: match.title,
        chunk_id: match.id,
        similarity: match.similarity,
      };
    }
  } catch {
    // A policy citation is useful but assignment remains available if RAG is offline.
  }
  return { band: local.band, hours: local.hours, source: "pilot-sla-policy.md", title: "Severity bands and repair deadlines" };
}

const assignmentSchema = z.object({
  issueId: z.number().int().positive(),
  assigneeType: z.enum(["contractor", "ngo"]),
  contractorId: z.number().int().positive().optional(),
  ngoId: z.number().int().positive().optional(),
  agreedCost: z.number().finite().nonnegative().optional(),
  deadline: z.coerce.date().optional(),
  createdBy: z.string().trim().min(1).max(120),
});

export async function assignWorkOrder(input: z.input<typeof assignmentSchema>) {
  const values = assignmentSchema.parse(input);
  if (values.assigneeType === "contractor" && !values.contractorId) throw new Error("contractorId is required");
  if (values.assigneeType === "ngo" && !values.ngoId) throw new Error("ngoId is required");

  const { data: issue, error: issueError } = await db().from("issues").select("id, severity, status").eq("id", values.issueId).single();
  if (issueError || !issue) throw new Error(`load issue: ${issueError?.message ?? "not found"}`);
  if (["fixed", "confirmed", "rejected"].includes(issue.status)) throw new Error("closed issues cannot be assigned");

  const basis = await deadlineBasis(issue.severity);
  const deadline = values.deadline ?? new Date(Date.now() + basis.hours * 60 * 60 * 1000);
  if (deadline.getTime() <= Date.now()) throw new Error("deadline must be in the future");

  const { data: workOrder, error } = await db()
    .from("work_orders")
    .insert({
      issue_id: values.issueId,
      assignee_type: values.assigneeType,
      contractor_id: values.assigneeType === "contractor" ? values.contractorId : null,
      ngo_id: values.assigneeType === "ngo" ? values.ngoId : null,
      agreed_cost: values.agreedCost ?? null,
      deadline: deadline.toISOString(),
      deadline_basis: basis,
      created_by: values.createdBy,
      status: "open",
      payment_status: "withheld",
    })
    .select("id, issue_id, deadline, deadline_basis, agreed_cost, payment_status, status")
    .single();
  if (error || !workOrder) throw new Error(`create work order: ${error?.message ?? "no row returned"}`);

  const { error: issueUpdateError } = await db().from("issues").update({ status: "assigned" }).eq("id", values.issueId);
  if (issueUpdateError) throw new Error(`assign issue: ${issueUpdateError.message}`);
  await audit({
    actorRole: "officer",
    actorName: values.createdBy,
    action: "work_order_created",
    entity: "work_order",
    entityId: workOrder.id,
    payload: { ...workOrder, issue_id: values.issueId },
  });
  return workOrder;
}

const repairSchema = z.object({
  workOrderId: z.number().int().positive(),
  actorName: z.string().trim().min(1).max(120),
  photo: z.instanceof(File),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  capturedAt: z.date(),
});

function photoExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

async function uploadRepair(bytes: Buffer, contentType: string, workOrderId: number) {
  const path = `repairs/${workOrderId}/${crypto.randomUUID()}.${photoExtension(contentType)}`;
  const { error } = await db().storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`upload repair proof: ${error.message}`);
  return path;
}

export async function submitRepairProof(input: z.input<typeof repairSchema>) {
  const values = repairSchema.parse(input);
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(values.photo.type) || values.photo.size === 0 || values.photo.size > MAX_REPAIR_BYTES) {
    throw new Error("repair photo must be JPEG, PNG, or WebP and no larger than 4 MB");
  }

  const { data: workOrder, error: workOrderError } = await db()
    .from("work_orders")
    .select("id, issue_id, status, created_at, deadline")
    .eq("id", values.workOrderId)
    .single();
  if (workOrderError || !workOrder) throw new Error(`load work order: ${workOrderError?.message ?? "not found"}`);
  if (["approved", "cancelled"].includes(workOrder.status)) throw new Error("work order is no longer active");

  const { data: issue, error: issueError } = await db()
    .from("issues")
    .select("id, location, status, reports(photo_path, created_at)")
    .eq("id", workOrder.issue_id)
    .single();
  if (issueError || !issue) throw new Error(`load issue: ${issueError?.message ?? "not found"}`);
  const reports = issue.reports as { photo_path: string; created_at: string }[];
  const original = reports[0];
  if (!original) throw new Error("issue has no original report photo");

  const bytes = Buffer.from(await values.photo.arrayBuffer());
  const photoPath = await uploadRepair(bytes, values.photo.type, values.workOrderId);
  const ageMinutes = (Date.now() - values.capturedAt.getTime()) / 60_000;
  const fresh = ageMinutes >= 0 && ageMinutes <= MAX_PHOTO_AGE_MINUTES;
  const afterWorkOrder = values.capturedAt.getTime() >= new Date(workOrder.created_at).getTime();
  const { data: distance, error: distanceError } = await db().rpc("repair_distance_to_issue", {
    target_issue_id: workOrder.issue_id,
    lat: values.lat,
    lng: values.lng,
  });
  if (distanceError) throw new Error(`repair distance: ${distanceError.message}`);
  const distanceM = Number(distance ?? Number.POSITIVE_INFINITY);
  const samePlace = distanceM <= REPAIR_MAX_DISTANCE_M;

  let ai: { same_location: "yes" | "no" | "unclear"; issue_resolved: "yes" | "partial" | "no" | "unclear"; confidence: number; reason: string } | null = null;
  if (fresh && afterWorkOrder && samePlace) {
    const { data: blob, error: downloadError } = await db().storage.from(PHOTO_BUCKET).download(original.photo_path);
    if (downloadError || !blob) throw new Error(`download original photo: ${downloadError?.message ?? "not found"}`);
    const before: ImageInput = { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: blob.type || "image/jpeg" };
    const after: ImageInput = { base64: bytes.toString("base64"), mimeType: values.photo.type };
    const result = await verifyRepairPhotos(before, after);
    ai = { same_location: result.same_location, issue_resolved: result.issue_resolved, confidence: result.confidence, reason: result.reason };
  }

  const approved = fresh && afterWorkOrder && samePlace && ai?.same_location === "yes" && ai.issue_resolved === "yes" && ai.confidence >= REPAIR_CONFIDENCE;
  const needsReview = fresh && afterWorkOrder && samePlace && !approved && ai?.same_location === "unclear";
  const verdict = approved ? "approved" : needsReview ? "needs_review" : "rejected";
  const verdictReason = approved
    ? ai?.reason ?? "The repair passed location, freshness, and visual checks."
    : !fresh
      ? "The repair photo is older than the allowed verification window."
      : !afterWorkOrder
        ? "The repair photo was captured before the work order was created."
        : !samePlace
          ? `The repair photo is ${Math.round(distanceM)} metres from the issue; the limit is ${REPAIR_MAX_DISTANCE_M} metres.`
          : ai?.reason ?? "The repair could not be confirmed.";

  const checks = { distance_m: distanceM, distance_passed: samePlace, fresh, after_work_order: afterWorkOrder, ai };
  const { data: proof, error: proofError } = await db()
    .from("repair_proofs")
    .insert({
      work_order_id: values.workOrderId,
      photo_path: photoPath,
      location: pointWkt(values.lat, values.lng),
      captured_at: values.capturedAt.toISOString(),
      distance_m: Number.isFinite(distanceM) ? distanceM : 999999,
      verdict,
      verdict_reason_en: verdictReason,
      checks,
      ai_raw: ai,
    })
    .select("id, work_order_id, verdict, verdict_reason_en, checks")
    .single();
  if (proofError || !proof) {
    await db().storage.from(PHOTO_BUCKET).remove([photoPath]);
    throw new Error(`save repair proof: ${proofError?.message ?? "no row returned"}`);
  }

  const nextWorkOrderStatus = approved ? "approved" : needsReview ? "submitted" : "rejected";
  const { error: orderError } = await db().from("work_orders").update({
    status: nextWorkOrderStatus,
    payment_status: approved ? "eligible" : "withheld",
  }).eq("id", values.workOrderId);
  if (orderError) throw new Error(`update work order: ${orderError.message}`);
  if (approved) {
    const { error: issueUpdateError } = await db().from("issues").update({ status: "fixed", fixed_at: new Date().toISOString() }).eq("id", workOrder.issue_id);
    if (issueUpdateError) throw new Error(`mark issue fixed: ${issueUpdateError.message}`);
  }
  await audit({
    actorRole: "contractor",
    actorName: values.actorName,
    action: "repair_proof_submitted",
    entity: "work_order",
    entityId: values.workOrderId,
    payload: { verdict, distance_m: distanceM, fresh, after_work_order: afterWorkOrder, ai_confidence: ai?.confidence ?? null },
  });
  return { ...proof, photoUrl: await signedPhotoUrl(photoPath), paymentStatus: approved ? "eligible" : "withheld" };
}

const feedbackSchema = z.object({
  issueId: z.number().int().positive(),
  citizenName: z.string().trim().min(1).max(120),
  verdict: z.enum(["confirmed", "disputed"]),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export async function submitCitizenFeedback(input: z.input<typeof feedbackSchema>) {
  const values = feedbackSchema.parse(input);
  const { data: feedback, error } = await db().from("citizen_feedback").insert(values).select("id, issue_id, verdict").single();
  if (error || !feedback) throw new Error(`save citizen feedback: ${error?.message ?? "no row returned"}`);
  const { error: issueError } = await db().from("issues").update({
    status: values.verdict === "confirmed" ? "confirmed" : "disputed",
    confirmed_at: values.verdict === "confirmed" ? new Date().toISOString() : null,
  }).eq("id", values.issueId);
  if (issueError) throw new Error(`update feedback status: ${issueError.message}`);
  await audit({
    actorRole: "citizen",
    actorName: values.citizenName,
    action: `repair_${values.verdict}`,
    entity: "issue",
    entityId: values.issueId,
    payload: { rating: values.rating ?? null, comment: values.comment ?? null },
  });
  return feedback;
}

export async function listContractorScorecards() {
  const { data, error } = await db().rpc("contractor_scorecards");
  if (error) throw new Error(`contractor scorecards: ${error.message}`);
  return data ?? [];
}

export async function listWorkOrdersForAssignee(input: { contractorId?: number; ngoId?: number; status?: string }) {
  if (!input.contractorId && !input.ngoId) throw new Error("contractorId or ngoId is required");
  let query = db()
    .from("work_orders")
    .select("id, issue_id, assignee_type, contractor_id, ngo_id, agreed_cost, deadline, deadline_basis, status, payment_status, created_at, updated_at, issues(issue_type, severity, status, road_name)")
    .order("deadline", { ascending: true });
  if (input.contractorId) query = query.eq("contractor_id", input.contractorId);
  if (input.ngoId) query = query.eq("ngo_id", input.ngoId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(`list work orders: ${error.message}`);
  return data ?? [];
}

export async function releasePayment(input: { workOrderId: number; actorName: string }) {
  const { data: order, error: loadError } = await db()
    .from("work_orders")
    .select("id, issue_id, status, payment_status")
    .eq("id", input.workOrderId)
    .single();
  if (loadError || !order) throw new Error(`load work order: ${loadError?.message ?? "not found"}`);
  if (order.payment_status !== "eligible" || order.status !== "approved") {
    throw new Error("payment is eligible only after an approved repair");
  }
  const { error } = await db().from("work_orders").update({ payment_status: "released" }).eq("id", input.workOrderId);
  if (error) throw new Error(`release payment: ${error.message}`);
  await audit({
    actorRole: "officer",
    actorName: input.actorName,
    action: "payment_released",
    entity: "work_order",
    entityId: input.workOrderId,
    payload: { issue_id: order.issue_id },
  });
  return { workOrderId: input.workOrderId, paymentStatus: "released" as const };
}

export async function listAuditEntries(input: { entity?: string; entityId?: number; limit?: number } = {}) {
  let query = db()
    .from("audit_log")
    .select("id, created_at, actor_role, actor_name, action, entity, entity_id, payload, prev_hash, hash")
    .order("id", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.entity) query = query.eq("entity", input.entity);
  if (input.entityId) query = query.eq("entity_id", input.entityId);
  const { data, error } = await query;
  if (error) throw new Error(`list audit entries: ${error.message}`);
  return data ?? [];
}

export async function verifyAuditChain() {
  const { data, error } = await db().rpc("verify_audit_chain");
  if (error) throw new Error(`verify audit chain: ${error.message}`);
  return (data?.[0] ?? { total: 0, first_broken_id: null }) as { total: number; first_broken_id: number | null };
}

export async function listWardStats() {
  const { data, error } = await db().rpc("ward_stats");
  if (error) throw new Error(`ward stats: ${error.message}`);
  return data ?? [];
}
