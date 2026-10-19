/**
 * Fills issues.area_en / area_bn for issues reported before area names were recorded.
 * Looks each location up on OpenStreetMap Nominatim (max 1 request per second, per its policy).
 *
 *   pnpm backfill:areas
 */
import { db } from "@/lib/supabase/server";
import { toPlaceName, type OsmAddress } from "@/lib/place-name";

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "CivicTrust-prototype/0.1 (AIBC 2026 civic issue reporting)";
const GAP_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function zone(lat: number, lng: number, lang: "en" | "bn"): Promise<string | null> {
  const url = `${ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=${lang}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const body = (await res.json()) as { address?: OsmAddress };
  return toPlaceName(body.address)?.zone ?? null;
}

async function main() {
  const { data, error } = await db()
    .from("issues")
    .select("id, lat:location_lat, lng:location_lng")
    .is("area_en", null)
    .order("id");
  if (error) throw new Error(error.message);
  const issues = (data ?? []) as { id: number; lat: number; lng: number }[];
  console.log(`${issues.length} issue(s) without an area`);
  for (const issue of issues) {
    const en = await zone(issue.lat, issue.lng, "en");
    await sleep(GAP_MS);
    const bn = await zone(issue.lat, issue.lng, "bn");
    await sleep(GAP_MS);
    const { error: updateError } = await db().from("issues").update({ area_en: en, area_bn: bn }).eq("id", issue.id);
    if (updateError) throw new Error(`issue ${issue.id}: ${updateError.message}`);
    console.log(`issue ${issue.id}: ${en ?? "—"} / ${bn ?? "—"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
