// Pure rules for the officer assistant, kept apart from the agent so they can be unit-tested.

export const QUESTION_MIN = 3;
export const QUESTION_MAX = 500;
/** Model steps per question: enough for a few tool calls and an answer, not an open-ended loop. */
export const MAX_STEPS = 6;
/** Whole-question budget; one answer must not hold the officer's page for long. */
export const ASK_TIMEOUT_MS = 45_000;

/** Trimmed question, or an error message for the officer. */
export function checkQuestion(raw: unknown): { ok: true; question: string } | { ok: false; error: "empty" | "too_short" | "too_long" } {
  const question = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!question) return { ok: false, error: "empty" };
  if (question.length < QUESTION_MIN) return { ok: false, error: "too_short" };
  if (question.length > QUESTION_MAX) return { ok: false, error: "too_long" };
  return { ok: true, question };
}

/** Bangla when the question has more Bangla letters than Latin ones; decided in code, not by the model. */
export function replyLanguage(question: string): "bn" | "en" {
  const bangla = question.match(/[ঀ-৿]/g)?.length ?? 0;
  const latin = question.match(/[A-Za-z]/g)?.length ?? 0;
  return bangla > latin ? "bn" : "en";
}

/** The panel shows plain text: drop Markdown emphasis, headings and odd citation brackets. */
export function plainAnswer(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/【([^】]*)】/g, "($1)")
    // A "#CT-" label must carry a real issue number; drop made-up ones like "(#CT-none)".
    .replace(/\s*[([]#CT[-‑](?!\d)[^)\]]*[)\]]/g, "")
    .replace(/#CT[-‑](?!\d)\S*\s?/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tool names in the order the agent first used them, from Mastra's step results. */
export function toolsUsed(steps: { toolCalls?: { payload?: { toolName?: string } }[] }[]): string[] {
  const names: string[] = [];
  for (const step of steps) for (const call of step.toolCalls ?? []) {
    const name = call.payload?.toolName;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Extra attempts after the model sends a tool call that leaves out a field. */
export const MAX_MALFORMED_RETRIES = 2;

/**
 * Groq rejects a tool call whose arguments don't match the schema before any tool runs, so the
 * question can safely be asked again; the next sample usually fills every field.
 */
export function isMalformedToolCall(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /tool call validation failed|tool_use_failed|did not match schema/i.test(message);
}

/** A provider refusal that another API key may not hit (rate limit or quota). */
export function isRateLimit(e: unknown): boolean {
  const status = (e as { statusCode?: unknown; status?: unknown } | null)?.statusCode ?? (e as { status?: unknown } | null)?.status;
  const message = e instanceof Error ? e.message : String(e);
  return status === 429 || /rate.?limit|quota|too many requests/i.test(message);
}
