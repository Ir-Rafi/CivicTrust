import "server-only";
import { glmEnv } from "@/lib/env";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

/** GLM handles text explanations through its OpenAI-compatible chat API. */
export async function explainSeverity(facts: {
  issueType: string;
  observations: string;
  severity: SeverityResult;
}): Promise<Explanation> {
  const env = glmEnv();
  const response = await fetch(`${env.GLM_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.GLM_TEXT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Write one-line civic issue urgency explanations for Bangladesh. Use only the supplied facts. " +
            "Return JSON with exactly reason_en and reason_bn. Each line must be under 140 characters. " +
            "reason_bn must be natural Bangla script, not transliteration.",
        },
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
