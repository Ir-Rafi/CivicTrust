import "server-only";
import { cacheLife } from "next/cache";
import { toPlaceName, type OsmAddress, type PlaceName } from "@/lib/place-name";

// Place names for a point, from OpenStreetMap's public Nominatim service. Called from our server
// only, so the citizen's browser never contacts it; it receives rounded coordinates, nothing else.
// Usage policy (operations.osmfoundation.org/policies/nominatim): identify the app, at most one
// request per second, cache results. For production, self-host Nominatim or use a paid geocoder.

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "CivicTrust-prototype/0.1 (AIBC 2026 civic issue reporting)";
const MIN_GAP_MS = 1100;
const TIMEOUT_MS = 4000;
/** 4 decimals ≈ 11 m: nearby GPS fixes share one cached lookup. */
const GRID = 1e4;

let nextSlot = 0;
/** At most one request per second from this server instance. */
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

/** Road, area and city for a point in the UI language; null when the lookup fails or finds nothing. */
export async function reverseGeocode(lat: number, lng: number, lang: "bn" | "en"): Promise<PlaceName | null> {
  try {
    return await cachedReverseGeocode(Math.round(lat * GRID) / GRID, Math.round(lng * GRID) / GRID, lang);
  } catch (e) {
    console.warn("reverse geocode failed", e instanceof Error ? e.message : e);
    return null;
  }
}

// Failures throw instead of returning null, so they are not kept in the cache.
async function cachedReverseGeocode(lat: number, lng: number, lang: "bn" | "en"): Promise<PlaceName | null> {
  "use cache";
  cacheLife("weeks"); // place names rarely change
  await throttle();
  const url = `${ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=${lang}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const body = (await response.json()) as { address?: OsmAddress };
  return toPlaceName(body.address);
}
