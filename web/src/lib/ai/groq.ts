import "server-only";
import Groq from "groq-sdk";
import { groqEnv } from "@/lib/env";
import { EXPLANATION_SYSTEM_PROMPT, EXPLANATION_TIMEOUT_MS } from "@/lib/ai/explanation-prompt";
import { toStrictJsonSchema } from "@/lib/ai/json-schema";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

// Groq is the primary text provider (fast, strict JSON): bilingual explanations now, the
// officer copilot later. GLM (glm.ts) is the fallback.

let client: Groq | undefined;
function groq(): Groq {
  // Fail fast so the GLM fallback still fits in the request budget.
  client ??= new Groq({ apiKey: groqEnv().GROQ_API_KEY, timeout: EXPLANATION_TIMEOUT_MS, maxRetries: 1 });
  return client;
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
  const res = await groq().chat.completions.create({
    model: groqEnv().GROQ_TEXT_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(facts) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "explanation", strict: true, schema: toStrictJsonSchema(explanationSchema) },
    },
  }, { timeout: timeoutMs, maxRetries: 0 });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned no output");
  return explanationSchema.parse(JSON.parse(content));
}
