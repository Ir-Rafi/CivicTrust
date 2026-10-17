import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Server-only Supabase client using the secret key.
 * The browser never talks to the database directly: RLS is on for every table
 * with no anon policies, so this is the only path in.
 */
export function db(): SupabaseClient {
  if (client) return client;
  const env = supabaseEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const PHOTO_BUCKET = "photos";

/** EWKT for a geography(Point) column. Note PostGIS order is lng, lat. */
export function pointWkt(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}
