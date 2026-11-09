import "server-only";
import { embedText } from "@/lib/ai/gemini";
import { db } from "@/lib/supabase/server";

export type PolicyMatch = { id: number; source: string; title: string; content: string; similarity: number };

/** Shared retrieval for deadline citations and the read-only MCP policy tool. */
export async function searchPilotPolicy(query: string, limit = 3): Promise<PolicyMatch[]> {
  const embedding = await embedText(query, "query");
  const { data, error } = await db().rpc("match_policy_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: limit,
  });
  if (error) throw new Error(`policy search: ${error.message}`);
  return (data ?? []) as PolicyMatch[];
}
