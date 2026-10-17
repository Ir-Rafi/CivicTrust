import { connection } from "next/server";
import { envStatus } from "@/lib/env";
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
  return Response.json({ configured, database });
}
