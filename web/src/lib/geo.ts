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

/**
 * Opens the exact point in Google Maps (the app on phones), to compare with the device's own
 * blue dot or to navigate there. Only followed when the user taps it.
 */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`;
}

/** The pilot area (Dhanmondi, Dhaka): where OSM roads/schools are loaded and pins may be placed. */
export const PILOT_BOUNDS = { south: 23.735, west: 90.365, north: 23.76, east: 90.39 } as const;
export const PILOT_CENTER: [number, number] = [
  (PILOT_BOUNDS.south + PILOT_BOUNDS.north) / 2,
  (PILOT_BOUNDS.west + PILOT_BOUNDS.east) / 2,
];

export function insidePilot(lat: number, lng: number): boolean {
  return lat >= PILOT_BOUNDS.south && lat <= PILOT_BOUNDS.north && lng >= PILOT_BOUNDS.west && lng <= PILOT_BOUNDS.east;
}
