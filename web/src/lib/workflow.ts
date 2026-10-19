import "server-only";

import { z } from "zod";
import { verifyRepairPhotos, type ImageInput } from "@/lib/ai/gemini";
import { embedText } from "@/lib/ai/gemini";
import { audit } from "@/lib/audit";
import { MAX_PHOTO_AGE_MINUTES, REPAIR_MAX_DISTANCE_M } from "@/lib/geo";
import { decideRepairVerdict, type RepairChecks } from "@/lib/repair-verdict";
import { computeSeverity, deadlineHoursFor } from "@/lib/severity";
import type { IssueType, VisualClass } from "@/lib/ai/schemas";
import { db, PHOTO_BUCKET, pointWkt } from "@/lib/supabase/server";
import { signedPhotoUrl, type StoredSeverity } from "@/lib/reports";

const MAX_REPAIR_BYTES = 4 * 1024 * 1024;
/** Work-order states in which the crew can (re)submit repair evidence. */
const SUBMITTABLE_ORDER_STATUSES = ["open", "in_progress", "rejected"];
const ACTIVE_ORDER_STATUSES = ["open", "in_progress", "submitted"];

export type QueueFilters = {
  status?: string;
  issueType?: IssueType;
  wardId?: number;
  /** OpenStreetMap area name in English (issues.area_en), e.g. "Lalmatia". */
  area?: string;
  limit?: number;
  offset?: number;
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
  area_en: string | null;
  area_bn: string | null;
  /** Exact location for the officer map; never return these from public actions. */
  lat: number;
  lng: number;
  created_at: string;
};

export async function listOfficerQueue(filters: QueueFilters = {}): Promise<OfficerQueueItem[]> {
  const offset = filters.offset ?? 0;
  let query = db()
    .from("issues")
    .select(
      "id, issue_type, visual_class, severity, severity_components, ai_confidence, ai_reason_en, ai_reason_bn, status, report_count, ward_id, road_name, area_en, area_bn, lat:location_lat, lng:location_lng, created_at",
    )
    .order("severity", { ascending: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + (filters.limit ?? 100) - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.issueType) query = query.eq("issue_type", filters.issueType);
  if (filters.wardId) query = query.eq("ward_id", filters.wardId);
  if (filters.area) query = query.eq("area_en", filters.area);
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
    .select("id, issue_type, visual_class, severity, severity_components, report_count, created_at")
    .eq("id", values.issueId)
    .single();
  if (loadError || !issue) throw new Error(`load issue: ${loadError?.message ?? "not found"}`);

  // Recompute the breakdown with the corrected photo class so the factors shown still add up.
  // An explicit severity is kept as officer_score; later duplicate merges respect it.
  const prior = issue.severity_components as StoredSeverity;
  const visualClass = values.visualClass ?? (issue.visual_class as VisualClass);
  const daysOpen = (Date.now() - new Date(issue.created_at).getTime()) / 86_400_000;
  const recomputed = computeSeverity({ visualClass, context: prior.context, reportCount: issue.report_count, daysOpen });
  const officerScore = values.severity ?? prior.officer_score;
  const components: StoredSeverity = { ...prior, ...recomputed, officer_score: officerScore };

  const next = {
    issue_type: values.issueType ?? issue.issue_type,
    visual_class: visualClass,
    severity: officerScore ?? recomputed.score,
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
    .update({ ...next, severity_components: components, ai_override: override })
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

  const { data: existing, error: existingError } = await db()
    .from("work_orders")
    .select("id, status")
    .eq("issue_id", values.issueId)
    .in("status", [...ACTIVE_ORDER_STATUSES, "rejected"]);
  if (existingError) throw new Error(`load work orders: ${existingError.message}`);
  const active = existing?.find((w) => ACTIVE_ORDER_STATUSES.includes(w.status));
  if (active) throw new Error(`issue already has an active work order (#${active.id})`);

  const basis = await deadlineBasis(issue.severity);
  const deadline = values.deadline ?? new Date(Date.now() + basis.hours * 60 * 60 * 1000);
  if (deadline.getTime() <= Date.now()) throw new Error("deadline must be in the future");

  // Reassigning after a rejected repair: close the old order so only one can be worked on or paid.
  for (const old of existing ?? []) {
    const { error: cancelError } = await db().from("work_orders").update({ status: "cancelled" }).eq("id", old.id);
    if (cancelError) throw new Error(`cancel work order ${old.id}: ${cancelError.message}`);
    await audit({
      actorRole: "officer",
      actorName: values.createdBy,
      action: "work_order_cancelled",
      entity: "work_order",
      entityId: old.id,
      payload: { issue_id: values.issueId, reason: "reassigned after a rejected repair" },
    });
  }

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
  actorRole: z.enum(["contractor", "ngo"]).default("contractor"),
  photo: z.instanceof(File),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  capturedAt: z.date(),
  /** "site": the "work site" demo option sent the issue's own coordinates instead of a GPS fix. */
  locationSource: z.enum(["gps", "site"]).default("gps"),
});

/** Gemini's limit for comparing before/after photos; a timeout sends the repair to an officer. */
const REPAIR_AI_TIMEOUT_MS = 40_000;

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

/** The issue's first citizen photo: the "before" image every repair is compared against. */
async function originalPhotoPath(issueId: number): Promise<string> {
  const { data, error } = await db()
    .from("reports")
    .select("photo_path, merged_as_duplicate")
    .eq("issue_id", issueId)
    .order("merged_as_duplicate", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load original photo: ${error.message}`);
  if (!data) throw new Error("issue has no original report photo");
  return data.photo_path;
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
  if (workOrder.status === "submitted") throw new Error("the last repair is waiting for officer review");
  if (!SUBMITTABLE_ORDER_STATUSES.includes(workOrder.status)) throw new Error("work order is no longer active");
  const beforePath = await originalPhotoPath(workOrder.issue_id);

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
  if (distanceError) {
    await db().storage.from(PHOTO_BUCKET).remove([photoPath]);
    throw new Error(`repair distance: ${distanceError.message}`);
  }
  const distanceM = Number(distance ?? Number.POSITIVE_INFINITY);
  const samePlace = distanceM <= REPAIR_MAX_DISTANCE_M;

  let ai: RepairChecks["ai"] & { reason: string } | null = null;
  let aiFailed = false;
  if (fresh && afterWorkOrder && samePlace) {
    try {
      const { data: blob, error: downloadError } = await db().storage.from(PHOTO_BUCKET).download(beforePath);
      if (downloadError || !blob) throw new Error(`download original photo: ${downloadError?.message ?? "not found"}`);
      const before: ImageInput = { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mimeType: blob.type || "image/jpeg" };
      const after: ImageInput = { base64: bytes.toString("base64"), mimeType: values.photo.type };
      const result = await verifyRepairPhotos(before, after, REPAIR_AI_TIMEOUT_MS);
      ai = { same_location: result.same_location, issue_resolved: result.issue_resolved, confidence: result.confidence, reason: result.reason };
    } catch (e) {
      // The hard checks passed; an AI outage must not reject the crew's work. An officer decides.
      console.error("repair verification AI failed", e);
      aiFailed = true;
    }
  }

  const locationMeasured = values.locationSource === "gps";
  const verdict = decideRepairVerdict({ fresh, afterWorkOrder, samePlace, ai, aiFailed, locationMeasured });
  const approved = verdict === "approved";
  const needsReview = verdict === "needs_review";
  const verdictReason = !fresh
    ? "The repair photo is older than the allowed verification window."
    : !afterWorkOrder
      ? "The repair photo was captured before the work order was created."
      : !samePlace
        ? `The repair photo is ${Math.round(distanceM)} metres from the issue; the limit is ${REPAIR_MAX_DISTANCE_M} metres.`
        : aiFailed
          ? "AI verification was unavailable. An officer will review the repair."
          : needsReview && !locationMeasured
            ? `${ai?.reason ?? "The AI could not confirm the repair."} The location was not measured (work-site demo option), so an officer must confirm the repair.`
            : needsReview
              ? `${ai?.reason ?? "The AI was not sure."} An officer will review the repair.`
            : ai?.reason ?? (approved ? "The repair passed location, freshness, and visual checks." : "The repair could not be confirmed.");

  const checks = {
    distance_m: distanceM,
    distance_passed: samePlace,
    location_source: values.locationSource,
    fresh,
    after_work_order: afterWorkOrder,
    ai,
    ai_failed: aiFailed,
  };
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
    actorRole: values.actorRole,
    actorName: values.actorName,
    action: "repair_proof_submitted",
    entity: "work_order",
    entityId: values.workOrderId,
    payload: {
      verdict,
      distance_m: distanceM,
      location_source: values.locationSource,
      fresh,
      after_work_order: afterWorkOrder,
      ai_confidence: ai?.confidence ?? null,
      ai_failed: aiFailed,
    },
  });
  return { ...proof, photoUrl: await signedPhotoUrl(photoPath), paymentStatus: approved ? "eligible" : "withheld" };
}

const reviewSchema = z.object({
  workOrderId: z.number().int().positive(),
  actorName: z.string().trim().min(1).max(120),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(1000),
});

/**
 * Officer decision on a work order waiting in "submitted": a repair the AI was unsure about,
 * or an approved repair a citizen disputed. The AI verdict stays on the proof; the officer's
 * decision is stored next to it and is what the payment gate reads.
 */
export async function reviewRepair(input: z.input<typeof reviewSchema>) {
  const values = reviewSchema.parse(input);
  const { data: order, error: loadError } = await db()
    .from("work_orders")
    .select("id, issue_id, status, payment_status")
    .eq("id", values.workOrderId)
    .single();
  if (loadError || !order) throw new Error(`load work order: ${loadError?.message ?? "not found"}`);
  if (order.status !== "submitted") throw new Error("only a repair waiting for officer review can be decided");

  const { data: proof, error: proofError } = await db()
    .from("repair_proofs")
    .select("id, verdict")
    .eq("work_order_id", values.workOrderId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (proofError) throw new Error(`load repair proof: ${proofError.message}`);
  if (!proof) throw new Error("work order has no repair proof to review");

  const { error: reviewError } = await db().from("repair_proofs").update({
    officer_decision: values.decision,
    officer_reason: values.reason,
    reviewed_by: values.actorName,
    reviewed_at: new Date().toISOString(),
  }).eq("id", proof.id);
  if (reviewError) throw new Error(`save review: ${reviewError.message}`);

  const approved = values.decision === "approved";
  const { error: orderError } = await db().from("work_orders").update({
    status: approved ? "approved" : "rejected",
    payment_status: approved ? "eligible" : "withheld",
  }).eq("id", values.workOrderId);
  if (orderError) throw new Error(`update work order: ${orderError.message}`);

  const { data: issue, error: issueLoadError } = await db().from("issues").select("fixed_at").eq("id", order.issue_id).single();
  if (issueLoadError || !issue) throw new Error(`load issue: ${issueLoadError?.message ?? "not found"}`);
  const { error: issueError } = await db().from("issues").update(
    approved
      ? { status: "fixed", fixed_at: issue.fixed_at ?? new Date().toISOString() }
      : { status: "assigned", fixed_at: null, confirmed_at: null },
  ).eq("id", order.issue_id);
  if (issueError) throw new Error(`update issue: ${issueError.message}`);

  await audit({
    actorRole: "officer",
    actorName: values.actorName,
    action: "repair_reviewed",
    entity: "work_order",
    entityId: values.workOrderId,
    payload: { issue_id: order.issue_id, proof_id: proof.id, ai_verdict: proof.verdict, decision: values.decision, reason: values.reason },
  });
  return { workOrderId: values.workOrderId, decision: values.decision, paymentStatus: approved ? "eligible" : "withheld" };
}

const feedbackSchema = z.object({
  issueId: z.number().int().positive(),
  citizenName: z.string().trim().min(1).max(120),
  verdict: z.enum(["confirmed", "disputed"]),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * Policy ("Citizen confirmation and disputes"): only after a job is marked fixed, only by a
 * citizen who reported it. A dispute reopens the job for officer review and withholds payment.
 */
export async function submitCitizenFeedback(input: z.input<typeof feedbackSchema>) {
  const values = feedbackSchema.parse(input);
  const { data: issue, error: issueLoadError } = await db().from("issues").select("id, status").eq("id", values.issueId).single();
  if (issueLoadError || !issue) throw new Error(`load issue: ${issueLoadError?.message ?? "not found"}`);
  if (issue.status !== "fixed") throw new Error("only a repaired issue can be confirmed or disputed");

  const { count, error: reporterError } = await db()
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("issue_id", values.issueId)
    .eq("reporter_name", values.citizenName);
  if (reporterError) throw new Error(`check reporter: ${reporterError.message}`);
  if (!count) throw new Error("only a citizen who reported this issue can confirm or dispute it");

  const { data: order, error: orderLoadError } = await db()
    .from("work_orders")
    .select("id, payment_status")
    .eq("issue_id", values.issueId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderLoadError) throw new Error(`load work order: ${orderLoadError.message}`);

  const { data: feedback, error } = await db().from("citizen_feedback").insert({
    issue_id: values.issueId,
    work_order_id: order?.id ?? null,
    citizen_name: values.citizenName,
    verdict: values.verdict,
    rating: values.rating ?? null,
    comment: values.comment ?? null,
  }).select("id, issue_id, verdict").single();
  if (error || !feedback) throw new Error(`save citizen feedback: ${error?.message ?? "no row returned"}`);

  const disputed = values.verdict === "disputed";
  const { error: issueError } = await db().from("issues").update({
    status: disputed ? "disputed" : "confirmed",
    confirmed_at: disputed ? null : new Date().toISOString(),
  }).eq("id", values.issueId);
  if (issueError) throw new Error(`update feedback status: ${issueError.message}`);

  // Back to the officer, payment withheld. If the payment has already gone out, the dispute is
  // still recorded and counted, and the audit entry says so.
  const reopened = disputed && !!order && order.payment_status !== "released";
  if (reopened) {
    const { error: reopenError } = await db().from("work_orders").update({ status: "submitted", payment_status: "withheld" }).eq("id", order.id);
    if (reopenError) throw new Error(`reopen work order: ${reopenError.message}`);
  }
  await audit({
    actorRole: "citizen",
    actorName: values.citizenName,
    action: `repair_${values.verdict}`,
    entity: "issue",
    entityId: values.issueId,
    payload: {
      rating: values.rating ?? null,
      comment: values.comment ?? null,
      work_order_id: order?.id ?? null,
      reopened_for_review: reopened,
      payment_already_released: disputed && order?.payment_status === "released",
    },
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
    .select("id, issue_id, status, payment_status, issues(status)")
    .eq("id", input.workOrderId)
    .single();
  if (loadError || !order) throw new Error(`load work order: ${loadError?.message ?? "not found"}`);
  if (order.payment_status !== "eligible" || order.status !== "approved") {
    throw new Error("payment is eligible only after an approved repair");
  }
  // The database trigger enforces the same rules; checking here gives a readable error.
  const issueStatus = (order.issues as unknown as { status: string } | null)?.status;
  if (issueStatus !== "fixed" && issueStatus !== "confirmed") {
    throw new Error("payment cannot be released while the repair is disputed or reopened");
  }
  const { error } = await db().from("work_orders").update({ payment_status: "released" }).eq("id", input.workOrderId);
  if (error) throw new Error(`release payment: ${error.message}`);
  await audit({
    actorRole: "officer",
    actorName: input.actorName,
    action: "payment_released",
    entity: "work_order",
    entityId: input.workOrderId,
    payload: { issue_id: order.issue_id, citizen_confirmed: issueStatus === "confirmed" },
  });
  return { workOrderId: input.workOrderId, paymentStatus: "released" as const };
}

type AuditEntry = {
  id: number;
  created_at: string;
  actor_role: string;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: number | null;
  payload: Record<string, unknown> | null;
  prev_hash: string;
  hash: string;
};

/**
 * `redact` hides citizen identities and free-text comments for anyone but officers (FR-10).
 * Hashes are untouched, so the chain can still be checked from the full rows server-side.
 */
export async function listAuditEntries(input: { entity?: string; entityId?: number; limit?: number; redact?: boolean } = {}) {
  let query = db()
    .from("audit_log")
    .select("id, created_at, actor_role, actor_name, action, entity, entity_id, payload, prev_hash, hash")
    .order("id", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.entity) query = query.eq("entity", input.entity);
  if (input.entityId) query = query.eq("entity_id", input.entityId);
  const { data, error } = await query;
  if (error) throw new Error(`list audit entries: ${error.message}`);
  const rows = (data ?? []) as AuditEntry[];
  if (!input.redact) return rows;
  return rows.map((row) => {
    const payload = row.payload ? { ...row.payload } : null;
    if (payload && "comment" in payload) payload.comment = payload.comment ? "[hidden]" : null;
    return { ...row, actor_name: row.actor_role === "citizen" ? "Citizen" : row.actor_name, payload };
  });
}

export async function verifyAuditChain() {
  const { data, error } = await db().rpc("verify_audit_chain");
  if (error) throw new Error(`verify audit chain: ${error.message}`);
  return (data?.[0] ?? { total: 0, first_broken_id: null }) as { total: number; first_broken_id: number | null };
}

export type AreaStatRow = {
  /** Negative for OpenStreetMap areas (no official ward id). */
  ward_id: number;
  ward_name_en: string | null;
  ward_name_bn: string | null;
  open_count: number;
  fixed_count: number;
  avg_fix_hours: number | null;
};

/**
 * Per-ward figures; until official ward boundaries are loaded, per OpenStreetMap area instead
 * (negative ids mark those rows, so the UI can say where the areas come from).
 */
export async function listWardStats(): Promise<AreaStatRow[]> {
  const { data, error } = await db().rpc("ward_stats");
  if (error) throw new Error(`ward stats: ${error.message}`);
  if (data?.length) return data as AreaStatRow[];
  const { data: areas, error: areaError } = await db().rpc("area_stats");
  if (areaError) throw new Error(`area stats: ${areaError.message}`);
  return ((areas ?? []) as { area_en: string | null; area_bn: string | null; open_count: number; fixed_count: number; avg_fix_hours: number | null }[]).map((a, i) => ({
    ward_id: -(i + 1),
    ward_name_en: a.area_en,
    ward_name_bn: a.area_bn,
    open_count: Number(a.open_count),
    fixed_count: Number(a.fixed_count),
    avg_fix_hours: a.avg_fix_hours,
  }));
}

/**
 * Everything recorded about one issue, oldest first: its reports, AI decisions, corrections,
 * work orders, repair evidence, reviews, citizen feedback and payment (FR-06: the original AI
 * result and every correction stay visible). Officers only: entries include names and comments.
 */
export async function listIssueHistory(issueId: number) {
  const { data: orders, error: orderError } = await db().from("work_orders").select("id").eq("issue_id", issueId);
  if (orderError) throw new Error(`history work orders: ${orderError.message}`);
  const orderIds = (orders ?? []).map((o) => o.id);
  const columns = "id, created_at, actor_role, actor_name, action, entity, entity_id, payload";
  const [issueRows, orderRows] = await Promise.all([
    db().from("audit_log").select(columns).eq("entity", "issue").eq("entity_id", issueId),
    orderIds.length
      ? db().from("audit_log").select(columns).eq("entity", "work_order").in("entity_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (issueRows.error) throw new Error(`history: ${issueRows.error.message}`);
  if (orderRows.error) throw new Error(`history: ${orderRows.error.message}`);
  return [...(issueRows.data ?? []), ...(orderRows.data ?? [])].sort((a, b) => a.id - b.id) as Omit<AuditEntry, "prev_hash" | "hash">[];
}

const offerSchema = z.object({
  issueId: z.number().int().positive(),
  ngoId: z.number().int().positive(),
  actorName: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
});

/** An NGO or volunteer group offers to fix an open, unassigned issue; the officer decides by assigning. */
export async function offerHelp(input: z.input<typeof offerSchema>) {
  const values = offerSchema.parse(input);
  const { data: issue, error: issueError } = await db().from("issues").select("id, status").eq("id", values.issueId).single();
  if (issueError || !issue) throw new Error(`load issue: ${issueError?.message ?? "not found"}`);
  if (!["reported", "verified"].includes(issue.status)) throw new Error("only open, unassigned issues can be offered for");
  const { data: offer, error } = await db()
    .from("ngo_offers")
    .upsert({ issue_id: values.issueId, ngo_id: values.ngoId, note: values.note ?? null }, { onConflict: "issue_id,ngo_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`save offer: ${error.message}`);
  if (offer) {
    await audit({
      actorRole: "ngo",
      actorName: values.actorName,
      action: "ngo_offer",
      entity: "issue",
      entityId: values.issueId,
      payload: { ngo_id: values.ngoId, note: values.note ?? null },
    });
  }
  return { issueId: values.issueId, ngoId: values.ngoId, alreadyOffered: !offer };
}

/** Which groups offered to help with an issue (officer issue detail). */
export async function listOffers(issueId: number) {
  const { data, error } = await db()
    .from("ngo_offers")
    .select("id, ngo_id, note, created_at, ngos(name)")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`list offers: ${error.message}`);
  return ((data ?? []) as unknown as { id: number; ngo_id: number; note: string | null; created_at: string; ngos: { name: string } | null }[]).map((o) => ({
    id: o.id,
    ngoId: o.ngo_id,
    ngoName: o.ngos?.name ?? null,
    note: o.note,
    createdAt: o.created_at,
  }));
}
