import "server-only";
import { z } from "zod";

// Each integration validates only its own variables, so the database works
// before AI keys exist (and vice versa). Parsed lazily so `next build` needs no keys.

const supabaseSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
});

const geminiSchema = z.object({
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_VISION_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
});

const groqSchema = z.object({
  GROQ_API_KEY: z.string().min(10),
  GROQ_TEXT_MODEL: z.string().default("openai/gpt-oss-120b"),
});

const glmSchema = z.object({
  GLM_API_KEY: z.string().min(10),
  GLM_API_BASE: z.url().default("https://open.bigmodel.cn/api/paas/v4"),
  GLM_TEXT_MODEL: z.string().default("glm-4.5-flash"),
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

/** Which integrations are configured, without throwing. Used by /api/health. */
export function envStatus() {
  return {
    supabase: supabaseSchema.safeParse(process.env).success,
    gemini: geminiSchema.safeParse(process.env).success,
    groq: groqSchema.safeParse(process.env).success,
    glm: glmSchema.safeParse(process.env).success,
  };
}

/** The model names in use (configured or the defaults above), readable without any API key. */
export function modelNames() {
  return {
    vision: geminiSchema.shape.GEMINI_VISION_MODEL.parse(process.env.GEMINI_VISION_MODEL),
    embedding: geminiSchema.shape.GEMINI_EMBEDDING_MODEL.parse(process.env.GEMINI_EMBEDDING_MODEL),
    text: groqSchema.shape.GROQ_TEXT_MODEL.parse(process.env.GROQ_TEXT_MODEL),
    textFallback: glmSchema.shape.GLM_TEXT_MODEL.parse(process.env.GLM_TEXT_MODEL),
  };
}
