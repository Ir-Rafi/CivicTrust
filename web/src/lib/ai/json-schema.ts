import { z } from "zod";

type JsonSchema = { [k: string]: unknown };

/**
 * Convert a Zod schema to a plain JSON Schema that both Gemini's response_format
 * and Groq's strict json_schema mode accept: no $schema key, every object closed
 * (additionalProperties: false) and every property listed in `required`.
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema, { target: "draft-7" }) as JsonSchema;
  delete raw.$schema;
  return closeObjects(raw) as JsonSchema;
}

function closeObjects(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(closeObjects);
  if (!node || typeof node !== "object") return node;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) out[key] = closeObjects(value);
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as JsonSchema);
  }
  return out;
}
