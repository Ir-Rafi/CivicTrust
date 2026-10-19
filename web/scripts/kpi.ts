/**
 * Measurements from the live system (requirements §8), read from the database and audit log.
 * Accuracy against a labelled photo set comes from `pnpm eval:photos` instead.
 *
 *   pnpm kpi                       # everything recorded so far
 *   pnpm kpi --since 2026-10-24    # only the field-test window
 *   pnpm kpi --json out.json       # also write the numbers to a file
 *
 * Audit entries for deleted (test) issues and work orders are left out.
 */
import { writeFile } from "node:fs/promises";
import { db } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
type Audit = { id: number; created_at: string; action: string; entity: string; entity_id: number | null; payload: Row | null };

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const since = arg("--since");
const jsonOut = arg("--json");

/** PostgREST returns at most 1000 rows per request: page through. Only rows created since `since`, if given. */
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const base = db().from(table).select(columns);
    const { data, error } = await (since ? base.gte("created_at", since) : base).order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (xs: number[], p: number) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function main() {
  const [issues, reports, orders, proofs, feedback, offers, audits] = await Promise.all([
    fetchAll<{ id: number; ai_override: Row | null; created_at: string }>("issues", "id, ai_override, created_at"),
    fetchAll<{ id: number; issue_id: number; merged_as_duplicate: boolean }>("reports", "id, issue_id, merged_as_duplicate"),
    fetchAll<{ id: number; issue_id: number; payment_status: string }>("work_orders", "id, issue_id, payment_status"),
    fetchAll<{ id: number; work_order_id: number; verdict: string; officer_decision: string | null; checks: Row }>(
      "repair_proofs",
      "id, work_order_id, verdict, officer_decision, checks",
    ),
    fetchAll<{ id: number; issue_id: number; verdict: string }>("citizen_feedback", "id, issue_id, verdict"),
    fetchAll<{ id: number; issue_id: number }>("ngo_offers", "id, issue_id"),
    fetchAll<Audit>("audit_log", "id, created_at, action, entity, entity_id, payload"),
  ]);

  const issueIds = new Set(issues.map((i) => i.id));
  const orderIds = new Set(orders.map((o) => o.id));
  // Keep audit entries about records that still exist (test issues were deleted), plus
  // report-level entries (rejected/failed photos are not stored as issues by design).
  const live = audits.filter((a) =>
    a.entity === "issue" ? a.entity_id !== null && issueIds.has(a.entity_id) : a.entity === "work_order" ? a.entity_id !== null && orderIds.has(a.entity_id) : true,
  );
  const by = (action: string) => live.filter((a) => a.action === action);
  const count = (items: { [k: string]: unknown }[], key: string) => {
    const m = new Map<unknown, number>();
    for (const it of items) m.set(it[key], (m.get(it[key]) ?? 0) + 1);
    return m;
  };

  // 1. Duplicate merge rate
  const merged = reports.filter((r) => r.merged_as_duplicate).length;

  // 2. Time from submission to a ranked issue (recorded since timing was added)
  const timings = [...by("issue_assessed"), ...by("report_merged")]
    .map((a) => (a.payload?.timing as { total_ms?: number } | undefined)?.total_ms)
    .filter((v): v is number => typeof v === "number");

  // 3. False closures: an AI-approved repair later rejected by the officer (dispute upheld).
  const aiApprovedOrders = new Set(proofs.filter((p) => p.verdict === "approved").map((p) => p.work_order_id));
  const overturned = new Set(
    by("repair_reviewed")
      .filter((a) => a.payload?.decision === "rejected" && a.entity_id !== null && aiApprovedOrders.has(a.entity_id))
      .map((a) => a.entity_id),
  );

  // 4. Audit-record completion: every stored record has its audit entry.
  const expected: [string, number, number][] = [];
  const pair = (name: string, need: Map<unknown, number>, have: Map<unknown, number>) => {
    let n = 0;
    let ok = 0;
    for (const [k, v] of need) {
      n += v;
      ok += Math.min(v, have.get(k) ?? 0);
    }
    expected.push([name, ok, n]);
  };
  const firstReports = reports.filter((r) => !r.merged_as_duplicate);
  pair("report submitted", count(firstReports, "issue_id"), count(by("report_submitted"), "entity_id"));
  pair("AI assessment", count(firstReports, "issue_id"), count(by("issue_assessed"), "entity_id"));
  pair("duplicate merged", count(reports.filter((r) => r.merged_as_duplicate), "issue_id"), count(by("report_merged"), "entity_id"));
  pair("officer correction", count(issues.filter((i) => i.ai_override), "id"), count(by("ai_override"), "entity_id"));
  pair("work order created", count(orders, "id"), count(by("work_order_created"), "entity_id"));
  pair("repair evidence", count(proofs, "work_order_id"), count(by("repair_proof_submitted"), "entity_id"));
  pair("officer repair review", count(proofs.filter((p) => p.officer_decision), "work_order_id"), count(by("repair_reviewed"), "entity_id"));
  pair("citizen feedback", count(feedback, "issue_id"), count([...by("repair_confirmed"), ...by("repair_disputed")], "entity_id"));
  pair("payment released", count(orders.filter((o) => o.payment_status === "released"), "id"), count(by("payment_released"), "entity_id"));
  pair("NGO offer", count(offers, "issue_id"), count(by("ngo_offer"), "entity_id"));
  const auditOk = expected.reduce((s, e) => s + e[1], 0);
  const auditNeed = expected.reduce((s, e) => s + e[2], 0);

  // 5. AI provider success and fallback
  const analysesOk = by("issue_assessed").length + by("report_merged").length + by("report_rejected").length;
  const analysesFailed = by("report_failed").length;
  const providers = count(by("issue_assessed").map((a) => ({ p: (a.payload?.explanation_provider as string | null | undefined) ?? "not recorded" })), "p");
  const dupChecks = by("issue_assessed").reduce((s, a) => s + Number(a.payload?.duplicate_checks ?? 0), 0);
  const dupFailures = by("issue_assessed").reduce((s, a) => s + Number(a.payload?.duplicate_check_failures ?? 0), 0);
  const repairAiCalls = proofs.filter((p) => (p.checks as { ai?: unknown; ai_failed?: boolean })?.ai || (p.checks as { ai_failed?: boolean })?.ai_failed);
  const repairAiFailed = repairAiCalls.filter((p) => (p.checks as { ai_failed?: boolean }).ai_failed).length;
  const officerCorrected = issues.filter((i) => i.ai_override).length;

  const results = {
    window: since ? `since ${since}` : "all records",
    counts: { issues: issues.length, reports: reports.length, work_orders: orders.length, repair_proofs: proofs.length, feedback: feedback.length },
    duplicate_merge_rate_pct: pct(merged, reports.length),
    submission_to_ranked_ms: { n: timings.length, median: median(timings), p90: percentile(timings, 90) },
    false_closure_rate_pct: pct(overturned.size, aiApprovedOrders.size),
    officer_correction_rate_pct: pct(officerCorrected, issues.length),
    audit_completion_pct: pct(auditOk, auditNeed),
    audit_completion_detail: expected.map(([name, ok, n]) => ({ record: name, recorded: ok, expected: n })),
    ai: {
      photo_analysis_success_pct: pct(analysesOk, analysesOk + analysesFailed),
      photo_analysis: { ok: analysesOk, failed: analysesFailed },
      explanation_providers: Object.fromEntries(providers),
      duplicate_compare_failure_pct: pct(dupFailures, dupChecks),
      repair_ai_failure_pct: pct(repairAiFailed, repairAiCalls.length),
    },
  };

  const fmt = (v: number | null, unit = "%") => (v === null ? "— (no data yet)" : `${v}${unit}`);
  console.log(`\nCivicTrust measurements (${results.window})`);
  console.log(`Records: ${issues.length} issues, ${reports.length} reports, ${orders.length} work orders, ${proofs.length} repair photos, ${feedback.length} citizen answers\n`);
  console.log(`| Measurement | Value |\n|---|---|`);
  console.log(`| Duplicate merge rate | ${fmt(results.duplicate_merge_rate_pct)} (${merged} of ${reports.length} reports) |`);
  console.log(`| Photo to ranked issue, median | ${fmt(results.submission_to_ranked_ms.median === null ? null : Math.round(results.submission_to_ranked_ms.median / 100) / 10, " s")} (n=${timings.length}; p90 ${fmt(results.submission_to_ranked_ms.p90 === null ? null : Math.round(results.submission_to_ranked_ms.p90 / 100) / 10, " s")}) |`);
  console.log(`| False-closure rate (AI-approved repairs overturned after a dispute) | ${fmt(results.false_closure_rate_pct)} (${overturned.size} of ${aiApprovedOrders.size}) |`);
  console.log(`| Officer corrections of the AI | ${fmt(results.officer_correction_rate_pct)} of issues |`);
  console.log(`| Audit-record completion | ${fmt(results.audit_completion_pct)} (${auditOk} of ${auditNeed}) |`);
  console.log(`| Photo analysis success | ${fmt(results.ai.photo_analysis_success_pct)} (${analysesFailed} failed) |`);
  console.log(`| Explanation provider | ${[...providers].map(([k, v]) => `${k}: ${v}`).join(", ") || "— (no data yet)"} |`);
  console.log(`| Duplicate comparison failures | ${fmt(results.ai.duplicate_compare_failure_pct)} |`);
  console.log(`| Repair-check AI failures (sent to officer) | ${fmt(results.ai.repair_ai_failure_pct)} |`);
  console.log(`\nAudit completion by record type:`);
  for (const e of results.audit_completion_detail) console.log(`  ${e.record.padEnd(22)} ${e.recorded}/${e.expected}`);
  if (jsonOut) {
    await writeFile(jsonOut, JSON.stringify(results, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
