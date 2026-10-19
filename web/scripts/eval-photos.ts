/**
 * Accuracy of the photo AI on a labelled set of real photos (requirements §8: issue
 * classification accuracy, repair verification accuracy, false closures on test pairs).
 * Uses the same Gemini calls and approval rule as the app. One Gemini request per photo or pair,
 * so run it with a key that has enough quota.
 *
 *   pnpm eval:photos <folder> [--json out.json]
 *
 * Folder layout (keep the photos out of git):
 *   <folder>/issues/<label>/*.jpg
 *       label = pothole | road_crack | garbage | open_drain | waterlogging | other | not_civic
 *   <folder>/repairs/<expected>/<pair name>/before.jpg and after.jpg
 *       expected = fixed | not_fixed | different_place
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { analyzeIssuePhoto, verifyRepairPhotos, type ImageInput } from "@/lib/ai/gemini";
import { decideRepairVerdict } from "@/lib/repair-verdict";

const AI_TIMEOUT_MS = 60_000;
const ISSUE_LABELS = ["pothole", "road_crack", "garbage", "open_drain", "waterlogging", "other", "not_civic"];
const REPAIR_EXPECTED = ["fixed", "not_fixed", "different_place"];
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const folder = process.argv[2];
const jsonIdx = process.argv.indexOf("--json");
const jsonOut = jsonIdx > 0 ? process.argv[jsonIdx + 1] : undefined;

async function listDir(path: string): Promise<string[]> {
  try {
    return (await readdir(path)).filter((n) => !n.startsWith("."));
  } catch {
    return [];
  }
}

async function image(path: string): Promise<ImageInput> {
  const mimeType = MIME[extname(path).toLowerCase()];
  if (!mimeType) throw new Error(`not a JPG/PNG/WebP photo: ${path}`);
  return { base64: (await readFile(path)).toString("base64"), mimeType };
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 1000) / 10}%`);

async function main() {
  if (!folder) throw new Error("usage: pnpm eval:photos <folder> [--json out.json]");

  // Issue photos: does the AI name the right problem (or reject a non-civic photo)?
  const issueResults: { file: string; label: string; predicted: string | null; error?: string }[] = [];
  for (const label of await listDir(join(folder, "issues"))) {
    if (!ISSUE_LABELS.includes(label)) {
      console.warn(`skipping issues/${label}: not one of ${ISSUE_LABELS.join(", ")}`);
      continue;
    }
    for (const file of await listDir(join(folder, "issues", label))) {
      const path = join(folder, "issues", label, file);
      try {
        const a = await analyzeIssuePhoto(await image(path), AI_TIMEOUT_MS);
        const predicted = a.is_civic_issue ? a.issue_type : "not_civic";
        issueResults.push({ file: path, label, predicted });
        console.log(`${predicted === label ? "✓" : "✗"} ${label.padEnd(13)} → ${predicted.padEnd(13)} ${file}`);
      } catch (e) {
        issueResults.push({ file: path, label, predicted: null, error: e instanceof Error ? e.message : String(e) });
        console.log(`! ${label.padEnd(13)} error: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // Before/after pairs: does the approval rule approve real fixes and nothing else?
  const repairResults: { pair: string; expected: string; verdict: string | null; error?: string }[] = [];
  for (const expected of await listDir(join(folder, "repairs"))) {
    if (!REPAIR_EXPECTED.includes(expected)) {
      console.warn(`skipping repairs/${expected}: not one of ${REPAIR_EXPECTED.join(", ")}`);
      continue;
    }
    for (const pair of await listDir(join(folder, "repairs", expected))) {
      const dir = join(folder, "repairs", expected, pair);
      const files = await listDir(dir);
      const before = files.find((f) => f.toLowerCase().startsWith("before"));
      const after = files.find((f) => f.toLowerCase().startsWith("after"));
      if (!before || !after) {
        console.warn(`skipping ${dir}: needs before.* and after.*`);
        continue;
      }
      try {
        const ai = await verifyRepairPhotos(await image(join(dir, before)), await image(join(dir, after)), AI_TIMEOUT_MS);
        // Location, freshness and timing are checked separately in the app; here only the visual judgement is tested.
        const verdict = decideRepairVerdict({ fresh: true, afterWorkOrder: true, samePlace: true, ai, locationMeasured: true });
        repairResults.push({ pair: dir, expected, verdict });
        const ok = expected === "fixed" ? verdict === "approved" : verdict !== "approved";
        console.log(`${ok ? "✓" : "✗"} ${expected.padEnd(15)} → ${verdict.padEnd(12)} ${pair}`);
      } catch (e) {
        repairResults.push({ pair: dir, expected, verdict: null, error: e instanceof Error ? e.message : String(e) });
        console.log(`! ${expected.padEnd(15)} error: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  const scored = issueResults.filter((r) => r.predicted !== null);
  const civic = scored.filter((r) => r.label !== "not_civic");
  const pairs = repairResults.filter((r) => r.verdict !== null);
  const fixedPairs = pairs.filter((r) => r.expected === "fixed");
  const notFixedPairs = pairs.filter((r) => r.expected !== "fixed");
  const falseApprovals = notFixedPairs.filter((r) => r.verdict === "approved").length;

  console.log(`\n| Measurement | Value |\n|---|---|`);
  console.log(`| Issue classification accuracy | ${pct(scored.filter((r) => r.predicted === r.label).length, scored.length)} (${scored.length} photos) |`);
  console.log(`| Civic vs non-civic accuracy | ${pct(scored.filter((r) => (r.label === "not_civic") === (r.predicted === "not_civic")).length, scored.length)} |`);
  console.log(`| Issue type accuracy (civic photos) | ${pct(civic.filter((r) => r.predicted === r.label).length, civic.length)} |`);
  console.log(`| Repair verification accuracy | ${pct(fixedPairs.filter((r) => r.verdict === "approved").length + notFixedPairs.length - falseApprovals, pairs.length)} (${pairs.length} pairs) |`);
  console.log(`| False closures on test pairs (not fixed but approved) | ${pct(falseApprovals, notFixedPairs.length)} (${falseApprovals} of ${notFixedPairs.length}) |`);
  console.log(`| Real fixes approved automatically | ${pct(fixedPairs.filter((r) => r.verdict === "approved").length, fixedPairs.length)} |`);
  console.log(`| Pairs sent to an officer | ${pct(pairs.filter((r) => r.verdict === "needs_review").length, pairs.length)} |`);
  const errors = issueResults.filter((r) => r.error).length + repairResults.filter((r) => r.error).length;
  if (errors) console.log(`\n${errors} item(s) failed (not counted); see "!" lines above.`);

  if (jsonOut) {
    await writeFile(jsonOut, JSON.stringify({ issues: issueResults, repairs: repairResults }, null, 2));
    console.log(`wrote ${jsonOut}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
