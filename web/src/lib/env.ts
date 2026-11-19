import "server-only";
import { z } from "zod";
import { parseList } from "@/lib/ai/provider-pool";

// Each integration validates only its own variables, so the database works
// before AI keys exist (and vice versa). Parsed lazily so `next build` needs no keys.

const supabaseSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
});

const geminiSchema = z.object({
  GEMINI_API_KEY: z.string().min(10),
  /** Optional extra keys (comma-separated) tried when a key hits its quota. Use keys from different projects. */
  GEMINI_API_KEYS: z.string().optional(),
  GEMINI_VISION_MODEL: z.string().default("gemini-3.8-flash"),
  /** Optional backup vision models (comma-separated), tried in order when the main model is overloaded. */
  GEMINI_VISION_FALLBACK_MODELS: z.string().optional(),
  /** If the main vision model hasn't answered after this many ms, the backup starts too (first answer wins). */
  GEMINI_HEDGE_MS: z.coerce.number().int().min(0).default(5000),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
});

const groqSchema = z.object({
  GROQ_API_KEY: z.string().min(10),
  /** Optional extra Groq keys (comma-separated) tried when a key hits its rate limit. */
  GROQ_API_KEYS: z.string().optional(),
  GROQ_TEXT_MODEL: z.string().default("openai/gpt-oss-120b"),
});

const glmSchema = z.object({
  GLM_API_KEY: z.string().min(10),
  GLM_API_BASE: z.url().default("https://open.bigmodel.cn/api/paas/v4"),
  GLM_TEXT_MODEL: z.string().default("glm-4.7-flash"),
  /** For models that always think (e.g. glm-5.3-flash): low, high or max. Unset = thinking disabled. */
  GLM_REASONING_EFFORT: z.enum(["low", "high", "max"]).optional(),
});

/** Optional local model through Ollama: last text fallback, only where an Ollama server is reachable. */
const ollamaSchema = z.object({
  OLLAMA_BASE_URL: z.url(),
  /** Best local model in `pnpm eval:local-models` (19/21 rules; Groq 21/21). */
  OLLAMA_MODEL: z.string().default("qwen2.5:3b"),
  /** Bearer token for a remote Ollama behind automation/ollama-tunnel; unset for a local server. */
  OLLAMA_API_KEY: z.string().min(32).optional(),
});

function lazyEnv<S extends z.ZodObject>(schema: S, name: string): () => z.infer<S> {
  let cached: z.infer<S> | undefined;
  return () => {
    if (cached) return cached;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`${name} is not configured: missing or invalid ${missing}. See .env.example.`);
    }
    cached = parsed.data;
    return cached;
  };
}

export const supabaseEnv = lazyEnv(supabaseSchema, "Supabase");
export const geminiEnv = lazyEnv(geminiSchema, "Gemini");
export const groqEnv = lazyEnv(groqSchema, "Groq");
export const glmEnv = lazyEnv(glmSchema, "GLM");
export const ollamaEnv = lazyEnv(ollamaSchema, "Ollama");

/** Which integrations are configured, without throwing. Used by /api/health. */
export function envStatus() {
  return {
    supabase: supabaseSchema.safeParse(process.env).success,
    gemini: geminiSchema.safeParse(process.env).success,
    groq: groqSchema.safeParse(process.env).success,
    glm: glmSchema.safeParse(process.env).success,
    ollama: ollamaSchema.safeParse(process.env).success,
  };
}

/** All Gemini keys: the main key first, then the extra ones. */
export function geminiKeys(): string[] {
  const env = geminiEnv();
  return parseList(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
}

/** All Groq keys: the main key first, then the extra ones. */
export function groqKeys(): string[] {
  const env = groqEnv();
  return parseList(env.GROQ_API_KEY, env.GROQ_API_KEYS);
}

/** The model names in use (configured or the defaults above), readable without any API key. */
export function modelNames() {
  const vision = geminiSchema.shape.GEMINI_VISION_MODEL.parse(process.env.GEMINI_VISION_MODEL);
  return {
    vision,
    /** Main vision model first, then the backups. */
    visionChain: parseList(vision, process.env.GEMINI_VISION_FALLBACK_MODELS),
    embedding: geminiSchema.shape.GEMINI_EMBEDDING_MODEL.parse(process.env.GEMINI_EMBEDDING_MODEL),
    text: groqSchema.shape.GROQ_TEXT_MODEL.parse(process.env.GROQ_TEXT_MODEL),
    textFallback: glmSchema.shape.GLM_TEXT_MODEL.parse(process.env.GLM_TEXT_MODEL),
    /** Null when no Ollama server is configured (e.g. on Vercel). */
    textLocal: process.env.OLLAMA_BASE_URL ? ollamaSchema.shape.OLLAMA_MODEL.parse(process.env.OLLAMA_MODEL) : null,
  };
}
