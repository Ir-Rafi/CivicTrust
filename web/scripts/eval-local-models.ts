/**
 * Compare local Ollama models on the explanation task, with Groq as the reference, using the same
 * prompt as the app. Each answer is checked against the prompt's own rules, so the default local
 * model is chosen on measured results rather than reputation. No database access.
 *
 *   pnpm eval:local-models gemma2:2b qwen2.5:3b llama3.2:3b
 *
 * Needs OLLAMA_BASE_URL (e.g. http://localhost:11434) and the models pulled with `ollama pull`.
 */
import { explainSeverity as explainWithGroq } from "@/lib/ai/groq";
import { explainSeverity as explainWithOllama } from "@/lib/ai/ollama";
import type { Explanation, VisualClass } from "@/lib/ai/schemas";
import { NEARBY_FACILITY_M } from "@/lib/geo";
import { num } from "@/lib/i18n";
import { computeSeverity, type LocationContext } from "@/lib/severity";

type Case = { name: string; issueType: string; visualClass: VisualClass; observations: string; context: LocationContext; reportCount: number; daysOpen: number };

const road = (highway: string, name: string | null) => ({ highway, name, distance_m: 4 });
const place = (name: string, distance_m: number) => ({ name, distance_m });

// Varied situations covering each rule in the prompt: distances, report counts, days open, no landmark.
const CASES: Case[] = [
  { name: "pothole near school", issueType: "pothole", visualClass: "severe", observations: "Deep pothole across most of the lane with broken asphalt edges.",
    context: { ward: null, road: road("residential", "Road 7"), nearest_school: place("Model School", 85), nearest_hospital: place("City Hospital", 900) }, reportCount: 1, daysOpen: 0 },
  { name: "garbage near hospital", issueType: "garbage", visualClass: "moderate", observations: "Pile of household waste spilling onto the road edge.",
    context: { ward: null, road: road("tertiary", null), nearest_school: place("Girls School", 760), nearest_hospital: place("Labaid Hospital", 230) }, reportCount: 2, daysOpen: 3 },
  { name: "water, nothing nearby", issueType: "waterlogging", visualClass: "minor", observations: "Shallow standing water on one side of the street.",
    context: { ward: null, road: road("service", null), nearest_school: place("High School", 1200), nearest_hospital: place("Clinic", 1500) }, reportCount: 1, daysOpen: 0 },
  { name: "open drain, main road", issueType: "open_drain", visualClass: "severe", observations: "Uncovered drain beside the footpath, about a metre deep.",
    context: { ward: null, road: road("primary", "Mirpur Road"), nearest_school: place("Ideal School", 140), nearest_hospital: place("General Hospital", 640) }, reportCount: 4, daysOpen: 6 },
];

/** The prompt's checkable rules, applied to one answer. */
function check(c: Case, e: Explanation): { passed: number; total: number; failed: string[] } {
  const failed: string[] = [];
  const rule = (ok: boolean, label: string) => ok || failed.push(label);
  rule(e.reason_en.length <= 140 && e.reason_bn.length <= 140, "under 140 characters");
  rule(!/[A-Za-z]/.test(e.reason_bn), "Bangla line has no Latin letters");
  const near = [c.context.nearest_school, c.context.nearest_hospital].filter((p) => p && p.distance_m <= NEARBY_FACILITY_M).sort((a, b) => a!.distance_m - b!.distance_m)[0];
  if (near) {
    rule(e.reason_en.includes(String(near.distance_m)), "keeps the distance (English)");
    rule(e.reason_bn.includes(num(near.distance_m, "bn")), "keeps the distance in Bangla digits");
  }
  if (c.reportCount > 1) rule(e.reason_en.includes(String(c.reportCount)), "mentions the report count");
  // "Nearest school or hospital if within 500 m": nothing farther away is named with a distance.
  if (!near) rule(!/\d[\d,]*\s?m\b/.test(e.reason_en) && !e.reason_bn.includes("মিটার"), "no distance to a far-away place");
  // Wording the prompt forbids in Bangla.
  rule(!/দিন ধরে(ই)? খোলা|পায়ের পথ/.test(e.reason_bn), "avoids the forbidden Bangla phrases");
  const total = 3 + (near ? 2 : 1) + (c.reportCount > 1 ? 1 : 0);
  return { passed: total - failed.length, total, failed };
}

async function main() {
  const models = process.argv.slice(2);
  if (!process.env.OLLAMA_BASE_URL || models.length === 0) throw new Error("Set OLLAMA_BASE_URL and pass model names, e.g. gemma2:2b qwen2.5:3b");
  const runners: [string, (facts: Parameters<typeof explainWithGroq>[0]) => Promise<Explanation>][] = [
    ["groq (reference)", (f) => explainWithGroq(f)],
    ...models.map((m) => [m, (f: Parameters<typeof explainWithGroq>[0]) => explainWithOllama(f, 60_000, m)] as [string, typeof explainWithGroq]),
  ];
  for (const [name, explain] of runners) {
    // Warm-up call so model loading time is not counted against the first case.
    if (name !== "groq (reference)") await explain(facts(CASES[0])).catch(() => null);
    let passed = 0;
    let total = 0;
    let errors = 0;
    const times: number[] = [];
    console.log(`\n== ${name}`);
    for (const c of CASES) {
      const t = Date.now();
      try {
        const e = await explain(facts(c));
        times.push(Date.now() - t);
        const r = check(c, e);
        passed += r.passed;
        total += r.total;
        console.log(`  ${c.name}: ${r.passed}/${r.total}${r.failed.length ? `  (missed: ${r.failed.join(", ")})` : ""}`);
        console.log(`    en: ${e.reason_en}\n    bn: ${e.reason_bn}`);
      } catch (err) {
        errors++;
        console.log(`  ${c.name}: FAILED ${err instanceof Error ? err.message : err}`);
      }
    }
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    console.log(`  SCORE ${passed}/${total} rules · ${errors} failed calls · median ${median ?? "—"} ms`);
  }
}

function facts(c: Case) {
  return {
    issueType: c.issueType,
    observations: c.observations,
    severity: computeSeverity({ visualClass: c.visualClass, context: c.context, reportCount: c.reportCount, daysOpen: c.daysOpen }),
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
