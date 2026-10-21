/**
 * Measurements from the live system (requirements §8), read from the database and audit log.
 * The same numbers are shown on the /impact page (both use src/lib/kpi.ts).
 * Accuracy against a labelled photo set comes from `pnpm eval:photos` instead.
 *
 *   pnpm kpi                       # everything recorded so far
 *   pnpm kpi --since 2026-10-24    # only the test window
 *   pnpm kpi --json out.json       # also write the numbers to a file
 *
 * Audit entries for deleted (test) issues and work orders are left out.
 */
import { writeFile } from "node:fs/promises";
import { computeKpis } from "@/lib/kpi";
import { parseSince } from "@/lib/kpi-math";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const sinceArg = arg("--since");
const since = parseSince(sinceArg);
if (sinceArg && !since) {
  console.error(`--since must be a date like 2026-10-24 (got "${sinceArg}")`);
  process.exit(1);
}
const jsonOut = arg("--json");

async function main() {
  const k = await computeKpis(since);
  const fmt = (v: number | null, unit = "%") => (v === null ? "— (no data yet)" : `${v}${unit}`);
  const sec = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);
  const c = k.counts;

  console.log(`\nCivicTrust measurements (${since ? `since ${since}` : "all records"})`);
  console.log(`Records: ${c.issues} issues, ${c.reports} reports, ${c.workOrders} work orders, ${c.repairProofs} repair photos, ${c.feedback} citizen answers\n`);
  console.log(`| Measurement | Value |\n|---|---|`);
  console.log(`| Duplicate merge rate | ${fmt(k.duplicateMerge.pct)} (${k.duplicateMerge.merged} of ${k.duplicateMerge.of} reports) |`);
  console.log(`| Photo to ranked issue, median | ${fmt(sec(k.triageMs.median), " s")} (n=${k.triageMs.n}; p90 ${fmt(sec(k.triageMs.p90), " s")}) |`);
  console.log(`| False-closure rate (AI-approved repairs overturned after a dispute) | ${fmt(k.falseClosure.pct)} (${k.falseClosure.overturned} of ${k.falseClosure.of}) |`);
  console.log(`| Payments released with an approved repair | ${fmt(k.paymentsBacked.pct)} (${k.paymentsBacked.backed} of ${k.paymentsBacked.of}) |`);
  console.log(`| Officer corrections of the AI | ${fmt(k.officerCorrections.pct)} of issues |`);
  console.log(`| Audit-record completion | ${fmt(k.auditCompletion.pct)} (${k.auditCompletion.recorded} of ${k.auditCompletion.of}) |`);
  console.log(`| Photo analysis success | ${fmt(k.photoAnalysis.pct)} (${k.photoAnalysis.failed} failed) |`);
  const e = k.explanations;
  console.log(`| Explanation provider | groq: ${e.groq}, glm: ${e.glm}, both failed: ${e.none}${e.notRecorded ? `, not recorded: ${e.notRecorded}` : ""} |`);
  console.log(`| Duplicate comparison failures | ${fmt(k.duplicateCompare.pct)} |`);
  console.log(`| Repair-check AI failures (sent to officer) | ${fmt(k.repairAi.pct)} |`);
  console.log(`\nAudit completion by record type:`);
  for (const d of k.auditCompletion.detail) console.log(`  ${d.record.padEnd(22)} ${d.recorded}/${d.expected}`);
  if (jsonOut) {
    await writeFile(jsonOut, JSON.stringify(k, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
