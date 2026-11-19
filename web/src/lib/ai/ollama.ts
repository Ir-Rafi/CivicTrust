import "server-only";
import { isBanglaScript } from "@/lib/ai/bangla";
import { ollamaEnv } from "@/lib/env";
import { EXPLANATION_SYSTEM_PROMPT, EXPLANATION_TIMEOUT_MS } from "@/lib/ai/explanation-prompt";
import { toStrictJsonSchema } from "@/lib/ai/json-schema";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

type Facts = { issueType: string; observations: string; severity: SeverityResult };

/**
 * Last text fallback (after Groq and GLM): an open-weight model on an Ollama server the team or
 * the city controls, so explanations keep working when both cloud providers are down and the facts
 * never leave that machine. Same prompt as the cloud providers; Ollama enforces the JSON schema.
 * Only used when OLLAMA_BASE_URL is set. The hosted demo can reach a team machine through the
 * token-checking gateway and Cloudflare Tunnel in automation/ollama-tunnel (OLLAMA_API_KEY).
 */
export async function explainSeverity(facts: Facts, timeoutMs: number = EXPLANATION_TIMEOUT_MS, model?: string): Promise<Explanation> {
  if (timeoutMs <= 0) throw new Error("Ollama skipped: no time left in the request budget");
  const env = ollamaEnv();
  const response = await fetch(`${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(env.OLLAMA_API_KEY ? { Authorization: `Bearer ${env.OLLAMA_API_KEY}` } : {}) },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      // An explicit model is only passed by the model comparison script.
      model: model ?? env.OLLAMA_MODEL,
      stream: false,
      format: toStrictJsonSchema(explanationSchema),
      options: { temperature: 0.2 },
      // Keep the model loaded between reports; loading it takes longer than answering.
      keep_alive: "30m",
      messages: [
        { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
  const payload = (await response.json()) as { message?: { content?: string } };
  const parsed = explanationSchema.safeParse(safeJson(payload.message?.content ?? ""));
  if (!parsed.success) throw new Error("Ollama returned an answer without reason_en and reason_bn");
  // Small models sometimes mix other scripts into the Bangla line; show nothing rather than that.
  if (!isBanglaScript(parsed.data.reason_bn)) throw new Error("Ollama's Bangla line contains other scripts");
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
