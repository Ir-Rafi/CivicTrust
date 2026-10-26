import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { geminiEnv, geminiKeys, modelNames } from "@/lib/env";
import { ProviderPool } from "@/lib/ai/provider-pool";
import { toStrictJsonSchema } from "@/lib/ai/json-schema";
import {
  duplicateCheckSchema,
  issueAnalysisSchema,
  repairCheckSchema,
  type DuplicateCheck,
  type IssueAnalysis,
  type RepairCheck,
} from "@/lib/ai/schemas";

// Gemini handles everything that needs eyes (M1 detect, M3 duplicate, M4 repair verify)
// plus embeddings for the policy RAG. Requests are sent with store: false so photos
// are not retained by the API for later retrieval.
// Calls go through a key pool (GEMINI_API_KEYS) and, for vision, a model chain
// (GEMINI_VISION_FALLBACK_MODELS) where the backup starts if the main model is slow
// (GEMINI_HEDGE_MS): see provider-pool.ts. Each vision result records the model
// that produced it.

export type ImageInput = { base64: string; mimeType: string };

/** Which model actually answered (the main one, or a backup when it was overloaded). */
export type WithModel<T> = T & { ai_model: string };

const clients = new Map<string, GoogleGenAI>();
function gemini(key: string): GoogleGenAI {
  let c = clients.get(key);
  if (!c) clients.set(key, (c = new GoogleGenAI({ apiKey: key })));
  return c;
}

let pool: ProviderPool | undefined;
function keyPool(): ProviderPool {
  pool ??= new ProviderPool(geminiKeys());
  return pool;
}

/**
 * Every call has a time limit and no automatic retries: the SDK default retries up to 5 times
 * with waits of up to 60 s, which made a slow response take over a minute and spent quota.
 * Callers have fallbacks (officer review, skip the duplicate check) for a timed-out call.
 */
async function visionJson<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  prompt: string;
  images: ImageInput[];
  timeoutMs: number;
}): Promise<WithModel<z.infer<S>>> {
  if (opts.timeoutMs <= 0) throw new Error("Gemini skipped: no time left in the request budget");
  const { value, model } = await keyPool().hedged(
    modelNames().visionChain,
    Date.now() + opts.timeoutMs,
    (key, model, timeoutMs) => visionOnce(key, model, timeoutMs, opts),
    geminiEnv().GEMINI_HEDGE_MS,
  );
  return Object.assign({}, value as object, { ai_model: model }) as WithModel<z.infer<S>>;
}

async function visionOnce<S extends z.ZodType>(
  key: string,
  model: string,
  timeoutMs: number,
  opts: { schema: S; system: string; prompt: string; images: ImageInput[] },
): Promise<z.infer<S>> {
  const interaction = await gemini(key).interactions.create(
    {
      model,
      system_instruction: opts.system,
      input: [
        { type: "text", text: opts.prompt },
        ...opts.images.map((img) => ({ type: "image" as const, data: img.base64, mime_type: img.mimeType })),
      ],
      response_format: { type: "text", mime_type: "application/json", schema: toStrictJsonSchema(opts.schema) },
      generation_config: { thinking_level: "low" },
      store: false,
    },
    { timeout_ms: timeoutMs, retries: { strategy: "none" } },
  );
  if (!interaction.output_text) throw new Error("Gemini returned no output");
  return opts.schema.parse(JSON.parse(interaction.output_text));
}

const INSPECTOR_SYSTEM = `You are a municipal road and sanitation inspector in Dhaka, Bangladesh.
You assess citizen photos of public infrastructure. Report only what is visible in the image.
If the photo is not a public road, footpath, drain or street-waste problem (for example a selfie,
indoor scene, screenshot or private property), set is_civic_issue to false and explain why.
Severity guide: minor = cosmetic, no hazard; moderate = degrades use or will worsen;
severe = immediate hazard to pedestrians, rickshaws or vehicles, or blocks drainage.`;

/** M1: classify issue type and visual severity from a citizen photo. */
export function analyzeIssuePhoto(photo: ImageInput, timeoutMs: number): Promise<WithModel<IssueAnalysis>> {
  return visionJson({
    schema: issueAnalysisSchema,
    system: INSPECTOR_SYSTEM,
    prompt: "Assess this citizen report photo.",
    images: [photo],
    timeoutMs,
  });
}

/** M3 (visual half): compare a new report with an existing nearby issue. */
export function compareForDuplicate(existing: ImageInput, incoming: ImageInput, timeoutMs: number): Promise<WithModel<DuplicateCheck>> {
  return visionJson({
    schema: duplicateCheckSchema,
    system: INSPECTOR_SYSTEM,
    prompt:
      "Image 1 is an existing report. Image 2 is a new report taken within 25 metres. " +
      "Do they show the same physical problem (same pothole, same garbage pile), allowing for different angles and lighting?",
    images: [existing, incoming],
    timeoutMs,
  });
}

/** M4 (visual half): judge a contractor's after-photo against the original report. */
export function verifyRepairPhotos(before: ImageInput, after: ImageInput, timeoutMs: number): Promise<WithModel<RepairCheck>> {
  return visionJson({
    schema: repairCheckSchema,
    system:
      INSPECTOR_SYSTEM +
      "\nYou now verify repairs before public money is released. Be strict: if the defect is still visible, " +
      "or you cannot tell that it is the same place, do not say it is resolved.",
    prompt:
      "Image 1 is the original problem. Image 2 is the contractor's after-repair photo. " +
      "Is it the same location, and is the problem fixed?",
    images: [before, after],
    timeoutMs,
  });
}

const EMBEDDING_DIMS = 768;
const EMBEDDING_TIMEOUT_MS = 10_000;

/** Text embedding for the policy RAG, normalized (required for reduced dimensions). */
export async function embedText(text: string, kind: "document" | "query"): Promise<number[]> {
  const { value: res } = await keyPool().run([geminiEnv().GEMINI_EMBEDDING_MODEL], Date.now() + EMBEDDING_TIMEOUT_MS, (key, model, timeoutMs) =>
    gemini(key).models.embedContent({
      model,
      contents: text,
      config: {
        outputDimensionality: EMBEDDING_DIMS,
        taskType: kind === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    }),
  );
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIMS) throw new Error("Unexpected embedding response");
  const norm = Math.hypot(...values);
  return values.map((v) => v / norm);
}
