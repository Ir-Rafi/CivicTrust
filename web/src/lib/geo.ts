/** Great-circle distance in metres (haversine). Good to well under a metre at street scale. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Repair proof must be taken within this distance of the original report (M4). */
export const REPAIR_MAX_DISTANCE_M = 15;
/** New reports within this radius of an open issue are duplicate candidates (M3). */
export const DUPLICATE_RADIUS_M = 25;
/** Schools/hospitals within this distance raise severity (M2) and are named as public landmarks. */
export const NEARBY_FACILITY_M = 500;
/** Within this distance a school/hospital adds the higher proximity score (M2). */
export const CLOSE_FACILITY_M = 200;
/** Photos must be captured in-app within this window before upload. */
export const MAX_PHOTO_AGE_MINUTES = 30;

/** Stop refining a GPS fix once it is as tight as the repair check's tolerance. */
export const GPS_TARGET_ACCURACY_M = REPAIR_MAX_DISTANCE_M;
/** How long the report form keeps listening for a better GPS fix. */
export const GPS_REFINE_MS = 20_000;

export type GpsQuality = "good" | "fair" | "poor";

/**
 * good: within the repair tolerance; fair: within the duplicate radius (still matches the right
 * issue); poor: wider than the duplicate radius, so the report may land on the wrong issue.
 */
export function gpsQuality(accuracyM: number): GpsQuality {
  if (accuracyM <= REPAIR_MAX_DISTANCE_M) return "good";
  if (accuracyM <= DUPLICATE_RADIUS_M) return "fair";
  return "poor";
}
