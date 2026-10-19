import "server-only";
import { glmEnv } from "@/lib/env";
import { EXPLANATION_SYSTEM_PROMPT, EXPLANATION_TIMEOUT_MS } from "@/lib/ai/explanation-prompt";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

/**
 * Fallback text provider (Groq is primary), through GLM's OpenAI-compatible chat API.
 * Thinking is disabled: with it on, glm-4.5-flash took over 60 s for a one-line answer.
 */
export async function explainSeverity(
  facts: {
    issueType: string;
    observations: string;
    severity: SeverityResult;
  },
  timeoutMs: number = EXPLANATION_TIMEOUT_MS,
): Promise<Explanation> {
  if (timeoutMs <= 0) throw new Error("GLM skipped: no time left in the request budget");
  const env = glmEnv();
  const response = await fetch(`${env.GLM_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GLM_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: env.GLM_TEXT_MODEL,
      temperature: 0.2,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`GLM request failed (${response.status})`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("GLM returned no output");
  return explanationSchema.parse(JSON.parse(content));
}
