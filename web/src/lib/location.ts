import "server-only";
import type { PlaceName } from "@/lib/place-name";
import { pickLandmark, type Landmark } from "@/lib/public-log-rules";
import { reverseGeocode } from "@/lib/reverse-geocode";
import type { LocationContext } from "@/lib/severity";
import { db } from "@/lib/supabase/server";

export type PlaceDescription = {
  /** Nearest mapped road within 40 m from the pilot data (what the severity score uses), or null outside it. */
  road: { name: string | null; highway: string } | null;
  landmark: Landmark | null;
  /** Road, area and city names from OpenStreetMap (anywhere, not just the pilot area); null if the lookup fails. */
  name: PlaceName | null;
};

/** Where a point is, in words people recognise. */
export async function describePlace(lat: number, lng: number, lang: "bn" | "en"): Promise<PlaceDescription> {
  const [{ data, error }, name] = await Promise.all([
    db().rpc("location_context", { lat, lng }),
    reverseGeocode(lat, lng, lang),
  ]);
  if (error) throw new Error(`location_context: ${error.message}`);
  const context = data as LocationContext;
  return {
    road: context.road ? { name: context.road.name, highway: context.road.highway } : null,
    landmark: pickLandmark(context),
    name,
  };
}
