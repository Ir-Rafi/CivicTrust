/**
 * Chunk data/policy/*.md by "## " section, embed with Gemini, and store in policy_chunks
 * for RAG (deadline citations, officer copilot).
 *
 *   pnpm seed:policy
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY } = process.env;
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !GEMINI_API_KEY) {
  throw new Error("Set SUPABASE_URL, SUPABASE_SECRET_KEY and GEMINI_API_KEY in .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function embed(text: string): Promise<number[]> {
  const res = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: 768, taskType: "RETRIEVAL_DOCUMENT" },
  });
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length !== 768) throw new Error("Unexpected embedding response");
  const norm = Math.hypot(...values);
  return values.map((v) => v / norm);
}

async function main() {
  const dir = path.join(process.cwd(), "data", "policy");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const text = await readFile(path.join(dir, file), "utf8");
    const docTitle = text.match(/^# (.+)$/m)?.[1] ?? file;
    const sections = text.split(/^## /m).slice(1);

    const rows = [];
    for (const section of sections) {
      const [heading, ...body] = section.split("\n");
      const content = body.join("\n").trim();
      const embedding = await embed(`${docTitle} — ${heading}\n\n${content}`);
      rows.push({ source: file, title: heading.trim(), content, embedding: JSON.stringify(embedding) });
    }

    const { error: delError } = await supabase.from("policy_chunks").delete().eq("source", file);
    if (delError) throw new Error(delError.message);
    const { error } = await supabase.from("policy_chunks").insert(rows);
    if (error) throw new Error(error.message);
    console.log(`${file}: ${rows.length} chunks embedded`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
