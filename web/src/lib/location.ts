import "server-only";
import { pickLandmark, type Landmark } from "@/lib/public-log-rules";
import type { LocationContext } from "@/lib/severity";
import { db } from "@/lib/supabase/server";

export type PlaceDescription = {
  /** Nearest mapped road within 40 m, or null outside the pilot data. */
  road: { name: string | null; highway: string } | null;
  landmark: Landmark | null;
};

/** Where a point is, in words people recognise: the road and the nearest named school or hospital. */
export async function describePlace(lat: number, lng: number): Promise<PlaceDescription> {
  const { data, error } = await db().rpc("location_context", { lat, lng });
  if (error) throw new Error(`location_context: ${error.message}`);
  const context = data as LocationContext;
  return {
    road: context.road ? { name: context.road.name, highway: context.road.highway } : null,
    landmark: pickLandmark(context),
  };
}
