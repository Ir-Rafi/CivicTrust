import "server-only";
import { glmEnv } from "@/lib/env";
import { EXPLANATION_SYSTEM_PROMPT, EXPLANATION_TIMEOUT_MS } from "@/lib/ai/explanation-prompt";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

type Facts = { issueType: string; observations: string; severity: SeverityResult };

// The free glm-4.7-flash is often busy: it refuses within a second with code 1305 (overloaded)
// or 1302 (rate limit). Those refusals, and an empty or malformed answer, are retried after a
// short wait while the time budget lasts. A missing balance (1113) is not retried.
const RETRY_CODES = new Set(["1302", "1305"]);
// 2 s apart: retrying faster trips the account's own rate limit (1302).
const RETRY_WAIT_MS = 2000;
const MIN_ATTEMPT_MS = 1500;

class RetryableGlmError extends Error {}

/**
 * Fallback text provider (Groq is primary), through GLM's OpenAI-compatible chat API.
 * Thinking is disabled: with it on, the flash models took over 60 s for a one-line answer.
 * Models that always think (e.g. glm-5.3-flash) reject that; for them set GLM_REASONING_EFFORT
 * (low, high or max) and the effort is sent instead.
 */
export async function explainSeverity(facts: Facts, timeoutMs: number = EXPLANATION_TIMEOUT_MS): Promise<Explanation> {
  if (timeoutMs <= 0) throw new Error("GLM skipped: no time left in the request budget");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await requestOnce(facts, deadline - Date.now());
    } catch (e) {
      if (!(e instanceof RetryableGlmError) || deadline - Date.now() < MIN_ATTEMPT_MS + RETRY_WAIT_MS) throw e;
      await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT_MS));
    }
  }
}

async function requestOnce(facts: Facts, timeoutMs: number): Promise<Explanation> {
  const env = glmEnv();
  const response = await fetch(`${env.GLM_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GLM_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: env.GLM_TEXT_MODEL,
      temperature: 0.2,
      ...(env.GLM_REASONING_EFFORT ? { reasoning_effort: env.GLM_REASONING_EFFORT } : { thinking: { type: "disabled" } }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string | number } } | null;
    const code = body?.error?.code === undefined ? "" : String(body.error.code);
    const message = `GLM request failed (${response.status}${code ? ` ${code}` : ""})`;
    throw RETRY_CODES.has(code) ? new RetryableGlmError(message) : new Error(message);
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new RetryableGlmError("GLM returned no output");
  const parsed = explanationSchema.safeParse(unwrap(safeJson(content)));
  if (!parsed.success) throw new RetryableGlmError("GLM returned an answer without reason_en and reason_bn");
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** glm-4.7-flash sometimes nests the answer one level deeper, e.g. {"answer": {"reason_en": …}}. */
function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && !("reason_en" in value)) {
    const inner = Object.values(value);
    if (inner.length === 1 && inner[0] && typeof inner[0] === "object") return inner[0];
  }
  return value;
}
