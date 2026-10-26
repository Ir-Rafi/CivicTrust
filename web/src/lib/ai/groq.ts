import "server-only";
import Groq from "groq-sdk";
import { groqEnv, groqKeys } from "@/lib/env";
import { ProviderPool } from "@/lib/ai/provider-pool";
import { EXPLANATION_SYSTEM_PROMPT, EXPLANATION_TIMEOUT_MS } from "@/lib/ai/explanation-prompt";
import { toStrictJsonSchema } from "@/lib/ai/json-schema";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

// Groq is the primary text provider (fast, strict JSON): bilingual explanations now, the
// officer copilot later. GLM (glm.ts) is the fallback.

const clients = new Map<string, Groq>();
function groq(key: string): Groq {
  let c = clients.get(key);
  // Fail fast so the GLM fallback still fits in the request budget.
  if (!c) clients.set(key, (c = new Groq({ apiKey: key, timeout: EXPLANATION_TIMEOUT_MS, maxRetries: 1 })));
  return c;
}

// Extra keys (GROQ_API_KEYS) take over when a key hits its rate limit: see provider-pool.ts.
let pool: ProviderPool | undefined;
function keyPool(): ProviderPool {
  pool ??= new ProviderPool(groqKeys());
  return pool;
}

/**
 * One-line Bangla + English reason for an issue's severity, written only from
 * computed facts so it cannot claim anything the pipeline didn't measure.
 */
export async function explainSeverity(
  facts: {
    issueType: string;
    observations: string;
    severity: SeverityResult;
  },
  timeoutMs: number = EXPLANATION_TIMEOUT_MS,
): Promise<Explanation> {
  if (timeoutMs <= 0) throw new Error("Groq skipped: no time left in the request budget");
  const { value: content } = await keyPool().run([groqEnv().GROQ_TEXT_MODEL], Date.now() + timeoutMs, async (key, model, ms) => {
    const res = await groq(key).chat.completions.create(
      {
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(facts) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "explanation", strict: true, schema: toStrictJsonSchema(explanationSchema) },
        },
      },
      { timeout: ms, maxRetries: 0 },
    );
    const text = res.choices[0]?.message?.content;
    if (!text) throw new Error("Groq returned no output");
    return text;
  });
  return explanationSchema.parse(JSON.parse(content));
}
