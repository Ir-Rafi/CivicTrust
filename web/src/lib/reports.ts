import "server-only";
import { cacheLife } from "next/cache";
import { analyzeIssuePhoto, compareForDuplicate, type ImageInput } from "@/lib/ai/gemini";
import { explainSeverity as explainWithGlm } from "@/lib/ai/glm";
import { explainSeverity as explainWithGroq } from "@/lib/ai/groq";
import { EXPLANATION_TIMEOUT_MS } from "@/lib/ai/explanation-prompt";
import type { Explanation } from "@/lib/ai/schemas";
import type { IssueAnalysis } from "@/lib/ai/schemas";
import { audit } from "@/lib/audit";
import { distanceMeters, DUPLICATE_RADIUS_M, insidePilot, MAX_PHOTO_AGE_MINUTES } from "@/lib/geo";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { computeSeverity, type LocationContext, type SeverityResult } from "@/lib/severity";
import { db, PHOTO_BUCKET, pointWkt } from "@/lib/supabase/server";
import { createBudget, type TimeBudget } from "@/lib/time-budget";

// Citizen report pipeline: photo -> M1 analysis -> M3 duplicate check -> M2 severity
// -> bilingual explanation -> store + audit. Every AI step is computed live.

export type ReportInput = {
  photo: File;
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: Date;
  /** gps: device fix; pin: the citizen placed the pin on the map (inside the pilot area); demo: a fixed demo spot. */
  locationSource: "gps" | "demo" | "pin";
  /** The device fix when the citizen moved the pin, so the move is on record. */
  gpsFix?: { lat: number; lng: number; accuracyM: number | null } | null;
  reporterName: string;
};

export type ReportOutcome =
  | { kind: "created"; issueId: number }
  | { kind: "merged"; issueId: number }
  | { kind: "rejected"; code: "too_old" | "bad_file" | "not_civic" | "outside_area"; detail?: string };

/** Stored in issues.severity_components so the score can be recomputed and explained later. */
export type StoredSeverity = SeverityResult & {
  context: LocationContext;
  analysis: IssueAnalysis;
  /** Severity set by an officer override; wins over the formula score until changed. */
  officer_score?: number;
};

/** The photo analysis failed or timed out: the citizen can retry; nothing was stored. */
export class AiBusyError extends Error {}

// Time budget. The report page allows 60 s (maxDuration); 50 s for AI calls leaves room for the
// upload, the database writes and the redirect. Each step gets its cap or what is left.
const REPORT_BUDGET_MS = 50_000;
const ANALYSIS_TIMEOUT_MS = 30_000;
const DUPLICATE_TIMEOUT_MS = 12_000;
/** Kept back from duplicate checks so the explanation still has time. */
const EXPLANATION_RESERVE_MS = 8_000;

type ExplanationResult = { explanation: Explanation | null; provider: "groq" | "glm" | null; ms: number; fallbackReason: string | null };

const shortError = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

/** Groq first, GLM if Groq fails and time is left; neither is essential (the breakdown explains the score). */
async function explainSeverity(
  facts: { issueType: string; observations: string; severity: SeverityResult },
  budget: TimeBudget,
): Promise<ExplanationResult> {
  const started = Date.now();
  let fallbackReason: string | null = null;
  try {
    const explanation = await explainWithGroq(facts, budget.timeoutFor(EXPLANATION_TIMEOUT_MS));
    return { explanation, provider: "groq", ms: Date.now() - started, fallbackReason };
  } catch (e) {
    fallbackReason = shortError(e);
    console.warn("Groq explanation failed, falling back to GLM", fallbackReason);
  }
  try {
    const explanation = await explainWithGlm(facts, budget.timeoutFor(EXPLANATION_TIMEOUT_MS));
    return { explanation, provider: "glm", ms: Date.now() - started, fallbackReason };
  } catch (e) {
    console.error("Groq and GLM explanations both failed", shortError(e));
    return { explanation: null, provider: null, ms: Date.now() - started, fallbackReason };
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
  // A placed pin is still a field report: the photo must be fresh too.
  if (stale && input.locationSource !== "demo") {
    return { kind: "rejected", code: "too_old" };
  }
  // Pins can only be placed where the pilot has map data (roads, schools, hospitals).
  if (input.locationSource === "pin" && !insidePilot(input.lat, input.lng)) {
    return { kind: "rejected", code: "outside_area" };
  }

  const budget = createBudget(REPORT_BUDGET_MS);
  const bytes = Buffer.from(await input.photo.arrayBuffer());
  const image: ImageInput = { base64: bytes.toString("base64"), mimeType: input.photo.type };
  // Area names (for per-area figures) are looked up while the AI looks at the photo. Never rejects.
  const areaNames = Promise.all([reverseGeocode(input.lat, input.lng, "en"), reverseGeocode(input.lat, input.lng, "bn")]);

  // M1: what is in the photo?
  let analysis: IssueAnalysis;
  try {
    analysis = await analyzeIssuePhoto(image, budget.timeoutFor(ANALYSIS_TIMEOUT_MS));
  } catch (e) {
    // Recorded so the AI success rate can be measured (requirements §8); no photo is kept.
    await audit({
      actorRole: "ai",
      actorName: "Gemini issue detector",
      action: "report_failed",
      entity: "report",
      payload: { stage: "analysis", error: shortError(e), total_ms: budget.elapsed(), location_source: input.locationSource },
    });
    throw new AiBusyError(shortError(e));
  }
  const analysisMs = budget.elapsed();
  if (!analysis.is_civic_issue) {
    // Not stored: we keep no photo of things that aren't civic problems.
    await audit({
      actorRole: "ai",
      actorName: "Gemini issue detector",
      action: "report_rejected",
      entity: "report",
      payload: {
        reason: analysis.rejection_reason,
        confidence: analysis.confidence,
        location_source: input.locationSource,
        timing: { total_ms: budget.elapsed(), analysis_ms: analysisMs },
      },
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
  const duplicateStarted = budget.elapsed();
  const duplicate = await findDuplicate(input, analysis, image, budget);
  const duplicateMs = budget.elapsed() - duplicateStarted;
  const photoPath = await uploadPhoto(bytes, input.photo.type);
  const device = describeDevice(input);

  if (duplicate.issueId) {
    return mergeIntoIssue(duplicate.issueId, input, analysis, photoPath, device, {
      total_ms: budget.elapsed(),
      analysis_ms: analysisMs,
      duplicate_ms: duplicateMs,
    });
  }

  // M2 + explanation
  const severity = computeSeverity({ visualClass: analysis.visual_class, context, reportCount: 1, daysOpen: 0 });
  const explained = await explainSeverity(
    { issueType: analysis.issue_type, observations: analysis.observations, severity },
    budget,
  );
  const explanation = explained.explanation;
  const [areaEn, areaBn] = await areaNames;

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
      area_en: areaEn?.zone ?? null,
      area_bn: areaBn?.zone ?? null,
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
    payload: { location_source: input.locationSource, accuracy_m: input.accuracyM, pin_moved_m: pinMovedM(input) },
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
      area: areaEn?.zone ?? null,
      // For the required measurements (§8): time to a ranked issue, and AI provider success/fallback.
      timing: { total_ms: budget.elapsed(), analysis_ms: analysisMs, duplicate_ms: duplicateMs, explanation_ms: explained.ms },
      explanation_provider: explained.provider,
      explanation_fallback_reason: explained.fallbackReason,
      duplicate_checks: duplicate.checks,
      duplicate_check_failures: duplicate.failures,
    },
  });

  return { kind: "created", issueId: issue.id };
}

type DuplicateResult = { issueId: number | null; checks: number; failures: number };

async function findDuplicate(input: ReportInput, analysis: IssueAnalysis, image: ImageInput, budget: TimeBudget): Promise<DuplicateResult> {
  const { data: nearby, error } = await db().rpc("nearby_open_issues", {
    lat: input.lat,
    lng: input.lng,
    radius_m: DUPLICATE_RADIUS_M,
  });
  if (error) throw new Error(`nearby_open_issues: ${error.message}`);
  const candidates = (nearby as { id: number; issue_type: string }[]).filter((c) => c.issue_type === analysis.issue_type);

  let checks = 0;
  let failures = 0;
  for (const candidate of candidates.slice(0, 2)) {
    const { data: first } = await db()
      .from("reports")
      .select("photo_path")
      .eq("issue_id", candidate.id)
      .order("merged_as_duplicate", { ascending: true })
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
    checks++;
    try {
      const check = await compareForDuplicate(existing, image, budget.timeoutFor(DUPLICATE_TIMEOUT_MS, EXPLANATION_RESERVE_MS));
      if (check.same_issue === "yes" && check.confidence >= MERGE_CONFIDENCE) return { issueId: candidate.id, checks, failures };
    } catch (e) {
      // A failed comparison never blocks the report: it is filed as a new issue (an officer can still spot it).
      failures++;
      console.warn("duplicate comparison failed", shortError(e));
    }
  }
  return { issueId: null, checks, failures };
}

async function mergeIntoIssue(
  issueId: number,
  input: ReportInput,
  analysis: IssueAnalysis,
  photoPath: string,
  device: string,
  timing: { total_ms: number; analysis_ms: number; duplicate_ms: number },
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
    payload: { report_count: reportCount, severity: effectiveSeverity, location_source: input.locationSource, timing },
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

/** How far the citizen moved the pin from the device's GPS fix (null when there was no fix or no pin). */
function pinMovedM(input: ReportInput): number | null {
  if (input.locationSource !== "pin" || !input.gpsFix) return null;
  return Math.round(distanceMeters(input, input.gpsFix));
}

function describeDevice(input: ReportInput): string {
  if (input.locationSource === "pin") {
    const moved = pinMovedM(input);
    const gps = input.gpsFix?.accuracyM != null ? ` ±${Math.round(input.gpsFix.accuracyM)}m` : "";
    return moved === null ? "pin (no GPS fix)" : `pin, ${moved}m from gps${gps}`;
  }
  const accuracy = input.accuracyM !== null ? ` ±${Math.round(input.accuracyM)}m` : "";
  return `${input.locationSource}${accuracy}`;
}

const SIGNED_URL_SECONDS = 3600;

/** Short-lived link to a private photo. */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  try {
    return await cachedSignedPhotoUrl(path);
  } catch {
    return null;
  }
}

// A fresh signature is a new URL, which the browser can't serve from its cache, so every
// navigation re-downloaded every photo. Reuse one URL per photo until it has ~10 min left.
async function cachedSignedPhotoUrl(path: string): Promise<string> {
  "use cache";
  cacheLife({ stale: 1800, revalidate: 1800, expire: SIGNED_URL_SECONDS - 600 });
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (!data?.signedUrl) throw new Error(`signed url: ${error?.message ?? "none"}`);
  return data.signedUrl;
}
