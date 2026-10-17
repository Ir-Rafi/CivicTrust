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
/** Photos must be captured in-app within this window before upload. */
export const MAX_PHOTO_AGE_MINUTES = 30;
