import "server-only";
import Groq from "groq-sdk";
import { groqEnv } from "@/lib/env";
import { toStrictJsonSchema } from "@/lib/ai/json-schema";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
import type { SeverityResult } from "@/lib/severity";

// Groq handles fast text reasoning: bilingual explanations now, the officer copilot later.

let client: Groq | undefined;
function groq(): Groq {
  client ??= new Groq({ apiKey: groqEnv().GROQ_API_KEY });
  return client;
}

/**
 * One-line Bangla + English reason for an issue's severity, written only from
 * computed facts so it cannot claim anything the pipeline didn't measure.
 */
export async function explainSeverity(facts: {
  issueType: string;
  observations: string;
  severity: SeverityResult;
}): Promise<Explanation> {
  const res = await groq().chat.completions.create({
    model: groqEnv().GROQ_TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You write one-line explanations of civic issue urgency for citizens and city officers in Bangladesh. " +
          "Use ONLY the facts provided; never invent distances, places or names. " +
          "Each line under 140 characters. reason_bn must be natural Bangla (বাংলা) script, not transliteration. " +
          'Example: "Severe pothole on a main road, 150 m from a school." / "প্রধান সড়কে গুরুতর গর্ত, স্কুল থেকে ১৫০ মিটার দূরে।" ' +
          "Bangla terms: residential road = আবাসিক রাস্তা, trunk/primary road = প্রধান সড়ক, " +
          "secondary/tertiary road = সংযোগ সড়ক, pothole = গর্ত, garbage = ময়লার স্তূপ, open drain = খোলা ড্রেন, " +
          "waterlogging = জলাবদ্ধতা, hospital = হাসপাতাল, school = স্কুল.",
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "explanation", strict: true, schema: toStrictJsonSchema(explanationSchema) },
    },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned no output");
  return explanationSchema.parse(JSON.parse(content));
}
