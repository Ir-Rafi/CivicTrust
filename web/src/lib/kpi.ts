import "server-only";
import { median, pct, percentile } from "@/lib/kpi-math";
import { db } from "@/lib/supabase/server";

// Measurements from the live system (requirements §8), read from the database and audit log.
// Shared by the /impact page and `pnpm kpi`, so both always report the same numbers.
// Accuracy against a labelled photo set comes from `pnpm eval:photos` instead.

type Row = Record<string, unknown>;
type Audit = { id: number; created_at: string; action: string; entity: string; entity_id: number | null; payload: Row | null };
type Proof = { id: number; work_order_id: number; verdict: string; officer_decision: string | null; checks: Row | null; created_at: string };

/** PostgREST returns at most 1000 rows per request: page through. Only rows created since `since`, if given. */
async function fetchAll<T>(table: string, columns: string, since: string | null): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const base = db().from(table).select(columns);
    const { data, error } = await (since ? base.gte("created_at", since) : base).order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

function countBy<T>(items: T[], key: (item: T) => unknown): Map<unknown, number> {
  const m = new Map<unknown, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

export type Kpis = Awaited<ReturnType<typeof computeKpis>>;

/** All measurements, optionally only for records created on or after `since` (YYYY-MM-DD, Dhaka time). */
export async function computeKpis(since: string | null) {
  const from = since ? `${since}T00:00:00+06:00` : null;
  const [issues, reports, orders, proofs, feedback, offers, audits] = await Promise.all([
    fetchAll<{ id: number; ai_override: Row | null }>("issues", "id, ai_override", from),
    fetchAll<{ id: number; issue_id: number; merged_as_duplicate: boolean }>("reports", "id, issue_id, merged_as_duplicate", from),
    fetchAll<{ id: number; issue_id: number; payment_status: string }>("work_orders", "id, issue_id, payment_status", from),
    fetchAll<Proof>("repair_proofs", "id, work_order_id, verdict, officer_decision, checks, created_at", from),
    fetchAll<{ id: number; issue_id: number }>("citizen_feedback", "id, issue_id", from),
    fetchAll<{ id: number; issue_id: number }>("ngo_offers", "id, issue_id", from),
    fetchAll<Audit>("audit_log", "id, created_at, action, entity, entity_id, payload", from),
  ]);

  const issueIds = new Set(issues.map((i) => i.id));
  const orderIds = new Set(orders.map((o) => o.id));
  // For audit completeness, keep entries about records that still exist (test issues were deleted),
  // plus report-level entries (rejected/failed photos are not stored as issues by design).
  const live = audits.filter((a) =>
    a.entity === "issue"
      ? a.entity_id !== null && issueIds.has(a.entity_id)
      : a.entity === "work_order"
        ? a.entity_id !== null && orderIds.has(a.entity_id)
        : true,
  );
  const by = (action: string) => live.filter((a) => a.action === action);
  // AI events count whether or not the record was deleted later: a run of the pipeline is a run.
  const events = (action: string) => audits.filter((a) => a.action === action);
  const entity = (a: Audit) => a.entity_id;

  // Duplicate merge rate
  const merged = reports.filter((r) => r.merged_as_duplicate).length;

  // Time from submission to a ranked issue (recorded since timing was added)
  const timings = [...events("issue_assessed"), ...events("report_merged")]
    .map((a) => (a.payload?.timing as { total_ms?: number } | undefined)?.total_ms)
    .filter((v): v is number => typeof v === "number");

  // False closures: an AI-approved repair later rejected by the officer (dispute upheld)
  const aiApprovedOrders = new Set(proofs.filter((p) => p.verdict === "approved").map((p) => p.work_order_id));
  const overturned = new Set(
    by("repair_reviewed")
      .filter((a) => a.payload?.decision === "rejected" && a.entity_id !== null && aiApprovedOrders.has(a.entity_id))
      .map(entity),
  );

  // Payments released with an approved repair behind them (latest proof decides, as in the payment gate)
  const latestProof = new Map<number, Proof>();
  for (const p of [...proofs].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)) latestProof.set(p.work_order_id, p);
  const released = orders.filter((o) => o.payment_status === "released");
  const backed = released.filter((o) => {
    const p = latestProof.get(o.id);
    return p !== undefined && (p.officer_decision ?? p.verdict) === "approved";
  }).length;

  // Audit-record completion: every stored record has its audit entry
  const audit: { record: string; recorded: number; expected: number }[] = [];
  const pair = (record: string, need: Map<unknown, number>, have: Map<unknown, number>) => {
    let expected = 0;
    let recorded = 0;
    for (const [k, v] of need) {
      expected += v;
      recorded += Math.min(v, have.get(k) ?? 0);
    }
    audit.push({ record, recorded, expected });
  };
  const firstReports = reports.filter((r) => !r.merged_as_duplicate);
  pair("report submitted", countBy(firstReports, (r) => r.issue_id), countBy(by("report_submitted"), entity));
  pair("AI assessment", countBy(firstReports, (r) => r.issue_id), countBy(by("issue_assessed"), entity));
  pair("duplicate merged", countBy(reports.filter((r) => r.merged_as_duplicate), (r) => r.issue_id), countBy(by("report_merged"), entity));
  pair("officer correction", countBy(issues.filter((i) => i.ai_override), (i) => i.id), countBy(by("ai_override"), entity));
  pair("work order created", countBy(orders, (o) => o.id), countBy(by("work_order_created"), entity));
  pair("repair evidence", countBy(proofs, (p) => p.work_order_id), countBy(by("repair_proof_submitted"), entity));
  pair("officer repair review", countBy(proofs.filter((p) => p.officer_decision), (p) => p.work_order_id), countBy(by("repair_reviewed"), entity));
  pair("citizen feedback", countBy(feedback, (f) => f.issue_id), countBy([...by("repair_confirmed"), ...by("repair_disputed")], entity));
  pair("payment released", countBy(released, (o) => o.id), countBy(by("payment_released"), entity));
  pair("NGO offer", countBy(offers, (o) => o.issue_id), countBy(by("ngo_offer"), entity));
  const auditRecorded = audit.reduce((s, e) => s + e.recorded, 0);
  const auditExpected = audit.reduce((s, e) => s + e.expected, 0);

  // AI provider success and fallback
  const analysesOk = events("issue_assessed").length + events("report_merged").length + events("report_rejected").length;
  const analysesFailed = events("report_failed").length;
  // Reports from before the provider was recorded have no key at all; null means both providers failed.
  const providers = countBy(events("issue_assessed"), (a) =>
    a.payload && "explanation_provider" in a.payload ? (a.payload.explanation_provider as string | null) : "not recorded",
  );
  const explained = {
    groq: providers.get("groq") ?? 0,
    glm: providers.get("glm") ?? 0,
    none: providers.get(null) ?? 0,
    notRecorded: providers.get("not recorded") ?? 0,
  };
  const explainedTotal = explained.groq + explained.glm + explained.none;
  // Comparisons are recorded on new issues and, since 21 Oct, on merges too.
  const comparisons = [...events("issue_assessed"), ...events("report_merged")];
  const dupChecks = comparisons.reduce((s, a) => s + Number(a.payload?.duplicate_checks ?? 0), 0);
  const dupFailures = comparisons.reduce((s, a) => s + Number(a.payload?.duplicate_check_failures ?? 0), 0);
  const repairAiCalls = proofs.filter((p) => p.checks?.ai || p.checks?.ai_failed);
  const repairAiFailed = repairAiCalls.filter((p) => p.checks?.ai_failed).length;
  const corrected = issues.filter((i) => i.ai_override).length;

  return {
    since,
    counts: { issues: issues.length, reports: reports.length, workOrders: orders.length, repairProofs: proofs.length, feedback: feedback.length },
    duplicateMerge: { merged, of: reports.length, pct: pct(merged, reports.length) },
    // samples: each run's time in ms, for the distribution chart on /impact
    triageMs: { n: timings.length, median: median(timings), p90: percentile(timings, 90), samples: timings },
    falseClosure: { overturned: overturned.size, of: aiApprovedOrders.size, pct: pct(overturned.size, aiApprovedOrders.size) },
    paymentsBacked: { backed, of: released.length, pct: pct(backed, released.length) },
    officerCorrections: { corrected, of: issues.length, pct: pct(corrected, issues.length) },
    auditCompletion: { recorded: auditRecorded, of: auditExpected, pct: pct(auditRecorded, auditExpected), detail: audit },
    photoAnalysis: { ok: analysesOk, failed: analysesFailed, of: analysesOk + analysesFailed, pct: pct(analysesOk, analysesOk + analysesFailed) },
    explanations: { ...explained, of: explainedTotal, fallbackPct: pct(explained.glm, explainedTotal), missingPct: pct(explained.none, explainedTotal) },
    duplicateCompare: { failures: dupFailures, of: dupChecks, pct: pct(dupFailures, dupChecks) },
    repairAi: { failed: repairAiFailed, of: repairAiCalls.length, pct: pct(repairAiFailed, repairAiCalls.length) },
  };
}
