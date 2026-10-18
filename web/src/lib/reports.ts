import "server-only";
import { analyzeIssuePhoto, compareForDuplicate, type ImageInput } from "@/lib/ai/gemini";
import { explainSeverity as explainWithGlm } from "@/lib/ai/glm";
import { explainSeverity as explainWithGroq } from "@/lib/ai/groq";
import type { Explanation } from "@/lib/ai/schemas";
import type { IssueAnalysis } from "@/lib/ai/schemas";
import { audit } from "@/lib/audit";
import { DUPLICATE_RADIUS_M, MAX_PHOTO_AGE_MINUTES } from "@/lib/geo";
import { computeSeverity, type LocationContext, type SeverityResult } from "@/lib/severity";
import { db, PHOTO_BUCKET, pointWkt } from "@/lib/supabase/server";

// Citizen report pipeline: photo -> M1 analysis -> M3 duplicate check -> M2 severity
// -> bilingual explanation -> store + audit. Every AI step is computed live.

export type ReportInput = {
  photo: File;
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: Date;
  locationSource: "gps" | "demo";
  reporterName: string;
};

export type ReportOutcome =
  | { kind: "created"; issueId: number }
  | { kind: "merged"; issueId: number }
  | { kind: "rejected"; code: "too_old" | "bad_file" | "not_civic"; detail?: string };

/** Stored in issues.severity_components so the score can be recomputed and explained later. */
export type StoredSeverity = SeverityResult & {
  context: LocationContext;
  analysis: IssueAnalysis;
  /** Severity set by an officer override; wins over the formula score until changed. */
  officer_score?: number;
};

async function explainSeverity(facts: {
  issueType: string;
  observations: string;
  severity: SeverityResult;
}): Promise<Explanation> {
  try {
    return await explainWithGroq(facts);
  } catch (e) {
    console.warn("Groq explanation failed, falling back to GLM", e);
    return explainWithGlm(facts);
  }
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024;
const CLOCK_SKEW_MS = 2 * 60 * 1000;
/** AI confidence at which an issue is auto-marked "verified" (a real civic problem). */
const AUTO_VERIFY_CONFIDENCE = 0.7;
/** Minimum confidence for merging into an existing issue. */
const MERGE_CONFIDENCE = 0.6;

export async function submitCitizenReport(input: ReportInput): Promise<ReportOutcome> {
  if (!ALLOWED_TYPES.has(input.photo.type) || input.photo.size === 0 || input.photo.size > MAX_BYTES) {
    return { kind: "rejected", code: "bad_file" };
  }
  // Freshness guards real field reports against old or copied photos. Demo-location reports
  // (laptop testing with sample photos) skip it; they are recorded as "demo" in the report and audit log.
  const ageMs = Date.now() - input.capturedAt.getTime();
  const stale = ageMs > MAX_PHOTO_AGE_MINUTES * 60 * 1000 || ageMs < -CLOCK_SKEW_MS;
  if (stale && input.locationSource === "gps") {
    return { kind: "rejected", code: "too_old" };
  }

  const bytes = Buffer.from(await input.photo.arrayBuffer());
  const image: ImageInput = { base64: bytes.toString("base64"), mimeType: input.photo.type };

  // M1: what is in the photo?
  const analysis = await analyzeIssuePhoto(image);
  if (!analysis.is_civic_issue) {
    // Not stored: we keep no photo of things that aren't civic problems.
    await audit({
      actorRole: "ai",
      actorName: "Gemini issue detector",
      action: "report_rejected",
      entity: "report",
      payload: { reason: analysis.rejection_reason, confidence: analysis.confidence, location_source: input.locationSource },
    });
    return { kind: "rejected", code: "not_civic", detail: analysis.rejection_reason ?? undefined };
  }

  const { data: contextData, error: ctxError } = await db().rpc("location_context", {
    lat: input.lat,
    lng: input.lng,
  });
  if (ctxError) throw new Error(`location_context: ${ctxError.message}`);
  const context = contextData as LocationContext;

  // M3: is this already reported nearby?
  const duplicateOf = await findDuplicate(input, analysis, image);
  const photoPath = await uploadPhoto(bytes, input.photo.type);
  const device = describeDevice(input);

  if (duplicateOf) {
    return mergeIntoIssue(duplicateOf, input, analysis, photoPath, device);
  }

  // M2 + explanation
  const severity = computeSeverity({ visualClass: analysis.visual_class, context, reportCount: 1, daysOpen: 0 });
  const explanation = await explainSeverity({
    issueType: analysis.issue_type,
    observations: analysis.observations,
    severity,
  }).catch((e) => {
    // Explanation is helpful, not essential; the breakdown still explains the score.
    console.error("Groq and GLM explanations both failed", e);
    return null;
  });

  const status = analysis.confidence >= AUTO_VERIFY_CONFIDENCE ? "verified" : "reported";
  const stored: StoredSeverity = { ...severity, context, analysis };
  const { data: issue, error: issueError } = await db()
    .from("issues")
    .insert({
      issue_type: analysis.issue_type,
      visual_class: analysis.visual_class,
      severity: severity.score,
      severity_components: stored,
      ai_confidence: analysis.confidence,
      ai_reason_en: explanation?.reason_en ?? analysis.observations,
      ai_reason_bn: explanation?.reason_bn ?? null,
      status,
      location: pointWkt(input.lat, input.lng),
      ward_id: context.ward?.id ?? null,
      road_highway: context.road?.highway ?? null,
      road_name: context.road?.name ?? null,
    })
    .select("id")
    .single();
  if (issueError || !issue) {
    await db().storage.from(PHOTO_BUCKET).remove([photoPath]);
    throw new Error(`insert issue: ${issueError?.message}`);
  }

  const { error: reportError } = await db().from("reports").insert({
    issue_id: issue.id,
    reporter_name: input.reporterName,
    photo_path: photoPath,
    location: pointWkt(input.lat, input.lng),
    captured_at: input.capturedAt.toISOString(),
    device,
    ai_raw: analysis,
  });
  if (reportError) {
    await db().from("issues").delete().eq("id", issue.id);
    await db().storage.from(PHOTO_BUCKET).remove([photoPath]);
    throw new Error(`insert report: ${reportError.message}`);
  }

  await audit({
    actorRole: "citizen",
    actorName: input.reporterName,
    action: "report_submitted",
    entity: "issue",
    entityId: issue.id,
    payload: { location_source: input.locationSource, accuracy_m: input.accuracyM },
  });
  await audit({
    actorRole: "ai",
    actorName: "Gemini issue detector",
    action: "issue_assessed",
    entity: "issue",
    entityId: issue.id,
    payload: {
      issue_type: analysis.issue_type,
      visual_class: analysis.visual_class,
      confidence: analysis.confidence,
      severity: severity.score,
      status,
    },
  });

  return { kind: "created", issueId: issue.id };
}

async function findDuplicate(input: ReportInput, analysis: IssueAnalysis, image: ImageInput): Promise<number | null> {
  const { data: nearby, error } = await db().rpc("nearby_open_issues", {
    lat: input.lat,
    lng: input.lng,
    radius_m: DUPLICATE_RADIUS_M,
  });
  if (error) throw new Error(`nearby_open_issues: ${error.message}`);
  const candidates = (nearby as { id: number; issue_type: string }[]).filter((c) => c.issue_type === analysis.issue_type);

  for (const candidate of candidates.slice(0, 2)) {
    const { data: first } = await db()
      .from("reports")
      .select("photo_path")
      .eq("issue_id", candidate.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first) continue;
    const { data: blob } = await db().storage.from(PHOTO_BUCKET).download(first.photo_path);
    if (!blob) continue;
    const existing: ImageInput = {
      base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      mimeType: blob.type || "image/jpeg",
    };
    const check = await compareForDuplicate(existing, image);
    if (check.same_issue === "yes" && check.confidence >= MERGE_CONFIDENCE) return candidate.id;
  }
  return null;
}

async function mergeIntoIssue(
  issueId: number,
  input: ReportInput,
  analysis: IssueAnalysis,
  photoPath: string,
  device: string,
): Promise<ReportOutcome> {
  const { data: issue, error } = await db()
    .from("issues")
    .select("report_count, visual_class, created_at, severity_components")
    .eq("id", issueId)
    .single();
  if (error || !issue) throw new Error(`load issue ${issueId}: ${error?.message}`);

  const reportCount = issue.report_count + 1;
  const prior = issue.severity_components as StoredSeverity;
  const daysOpen = (Date.now() - new Date(issue.created_at).getTime()) / 86_400_000;
  const severity = computeSeverity({ visualClass: issue.visual_class, context: prior.context, reportCount, daysOpen });

  const { error: reportError } = await db().from("reports").insert({
    issue_id: issueId,
    reporter_name: input.reporterName,
    photo_path: photoPath,
    location: pointWkt(input.lat, input.lng),
    captured_at: input.capturedAt.toISOString(),
    device,
    merged_as_duplicate: true,
    ai_raw: analysis,
  });
  if (reportError) {
    await db().storage.from(PHOTO_BUCKET).remove([photoPath]);
    throw new Error(`insert report: ${reportError.message}`);
  }

  // An officer's corrected severity must survive later duplicate reports.
  const effectiveSeverity = prior.officer_score ?? severity.score;
  const { error: updateError } = await db()
    .from("issues")
    .update({
      report_count: reportCount,
      severity: effectiveSeverity,
      severity_components: { ...prior, ...severity },
    })
    .eq("id", issueId);
  if (updateError) throw new Error(`update merged issue ${issueId}: ${updateError.message}`);

  await audit({
    actorRole: "ai",
    actorName: "Gemini duplicate filter",
    action: "report_merged",
    entity: "issue",
    entityId: issueId,
    payload: { report_count: reportCount, severity: effectiveSeverity, location_source: input.locationSource },
  });
  return { kind: "merged", issueId };
}

async function uploadPhoto(bytes: Buffer, contentType: string): Promise<string> {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `reports/${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType });
  if (error) throw new Error(`upload photo: ${error.message}`);
  return path;
}

function describeDevice(input: ReportInput): string {
  const accuracy = input.accuracyM !== null ? ` ±${Math.round(input.accuracyM)}m` : "";
  return `${input.locationSource}${accuracy}`;
}

/** Short-lived link to a private photo. */
export async function signedPhotoUrl(path: string, seconds = 3600): Promise<string | null> {
  const { data } = await db().storage.from(PHOTO_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
