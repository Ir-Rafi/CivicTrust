/**
 * End-to-end smoke test of the AI layer against the real database and APIs.
 *
 *   pnpm smoke:ai                       # explanation (Groq primary + GLM fallback)
 *   pnpm smoke:ai path/to/photo.jpg     # + Gemini photo analysis
 *
 * Runs with --conditions=react-server so the app's server-only modules load as-is.
 */
import { readFile } from "node:fs/promises";
import { explainSeverity as explainWithGlm } from "@/lib/ai/glm";
import { explainSeverity as explainWithGroq } from "@/lib/ai/groq";
import { db } from "@/lib/supabase/server";
import { computeSeverity, type LocationContext } from "@/lib/severity";
import type { VisualClass } from "@/lib/ai/schemas";

// A residential lane in Dhanmondi near a school and a hospital (pilot area).
const LAT = 23.7465;
const LNG = 90.374;

async function main() {
  const { data: context, error } = await db().rpc("location_context", { lat: LAT, lng: LNG });
  if (error) throw new Error(error.message);
  console.log("location_context:", JSON.stringify(context));

  let visualClass: VisualClass = "severe";
  let issueType = "pothole";
  let observations = "Deep pothole across most of the lane with broken asphalt edges.";

  const photoPath = process.argv[2];
  if (photoPath) {
    const { analyzeIssuePhoto } = await import("@/lib/ai/gemini");
    const base64 = (await readFile(photoPath)).toString("base64");
    const mimeType = photoPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const t = Date.now();
    const analysis = await analyzeIssuePhoto({ base64, mimeType }, 60_000);
    console.log(`gemini (${Date.now() - t} ms):`, JSON.stringify(analysis, null, 2));
    visualClass = analysis.visual_class;
    issueType = analysis.issue_type;
    observations = analysis.observations;
  }

  const severity = computeSeverity({ visualClass, context: context as LocationContext, reportCount: 1, daysOpen: 0 });
  console.log("severity:", severity.score, severity.components.map((c) => `${c.key}=${c.points}`).join(" "));

  // Every configured provider, so a broken fallback shows up before the demo does.
  const facts = { issueType, observations, severity };
  const providers: [string, typeof explainWithGroq][] = [["groq", explainWithGroq], ["glm", explainWithGlm]];
  if (process.env.OLLAMA_BASE_URL) providers.push(["ollama", (await import("@/lib/ai/ollama")).explainSeverity]);
  for (const [name, explain] of providers) {
    const t = Date.now();
    try {
      const explanation = await explain(facts);
      console.log(`${name} (${Date.now() - t} ms):`, JSON.stringify(explanation, null, 2));
    } catch (e) {
      console.log(`${name} FAILED (${Date.now() - t} ms):`, e instanceof Error ? e.message : e);
    }
  }

  // RAG: which policy rule governs this issue's deadline?
  const { embedText } = await import("@/lib/ai/gemini");
  const query = `Repair deadline for a ${visualClass} ${issueType} with severity ${severity.score} near a school`;
  const embedding = await embedText(query, "query");
  const { data: matches, error: ragError } = await db().rpc("match_policy_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: 3,
  });
  if (ragError) throw new Error(ragError.message);
  console.log(`rag "${query}":`);
  for (const m of matches as { title: string; similarity: number }[]) {
    console.log(`  ${m.similarity.toFixed(3)}  ${m.title}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
