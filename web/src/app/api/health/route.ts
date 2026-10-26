import { connection } from "next/server";
import { envStatus, geminiKeys, groqKeys, modelNames } from "@/lib/env";
import { db } from "@/lib/supabase/server";

/** Setup check: which integrations are configured and whether the database answers. */
export async function GET() {
  await connection();
  const configured = envStatus();
  let database: { ok: boolean; wards?: number; pois?: number; roads?: number; error?: string } = { ok: false };
  if (configured.supabase) {
    try {
      const counts = await Promise.all(
        (["wards", "pois", "roads"] as const).map(async (table) => {
          const { count, error } = await db().from(table).select("*", { count: "exact", head: true });
          if (error) throw new Error(`${table}: ${error.message}`);
          return count ?? 0;
        }),
      );
      database = { ok: true, wards: counts[0], pois: counts[1], roads: counts[2] };
    } catch (e) {
      database = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  // How many Gemini keys are in the pool and the vision model order; never the keys themselves.
  const ai = {
    geminiKeys: configured.gemini ? geminiKeys().length : 0,
    groqKeys: configured.groq ? groqKeys().length : 0,
    visionModels: modelNames().visionChain,
  };
  return Response.json({ configured, database, ai });
}
