/**
 * Fetch real reference data for the pilot area from OpenStreetMap (Overpass API)
 * and write GeoJSON files to data/osm/. Data © OpenStreetMap contributors, ODbL.
 *
 *   pnpm seed:fetch                       # default pilot bbox
 *   pnpm seed:fetch 23.735,90.365,23.760,90.390   # south,west,north,east
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import osmtogeojson from "osmtogeojson";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";

// Default pilot area: Dhanmondi / Kalabagan / Jigatola, Dhaka. Override via CLI arg.
const DEFAULT_BBOX = "23.735,90.365,23.760,90.390";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Some OSM features tagged amenity=hospital are pharmacies, offices or info desks.
// They must not earn the "near a hospital" severity bonus.
const NOT_CARE_FACILITY = /pharmac|information cent|supply chain|head office|homeo|medical hall/i;

const ROAD_CLASSES =
  "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|" +
  "motorway_link|trunk_link|primary_link|secondary_link|tertiary_link";

async function main() {
  const bbox = process.argv[2] ?? DEFAULT_BBOX;
  if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bbox)) throw new Error("bbox must be south,west,north,east");

  const query = `
    [out:json][timeout:180];
    (
      nwr["amenity"~"^(school|college|hospital|clinic)$"](${bbox});
      way["highway"~"^(${ROAD_CLASSES})$"](${bbox});
      relation["boundary"="administrative"]["admin_level"~"^(8|9|10)$"](${bbox});
    );
    out geom;
  `;
  console.log(`Querying Overpass for bbox ${bbox} ...`);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "CivicTrust-prototype/0.1" },
    body: new URLSearchParams({ data: query }),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const osm = await res.json();
  const geo = osmtogeojson(osm) as FeatureCollection;

  const pois: Feature[] = [];
  const roads: Feature[] = [];
  const wards: Feature[] = [];

  for (const f of geo.features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const id = String(f.id ?? p.id);
    const name = (p["name:en"] ?? p.name ?? null) as string | null;
    const nameBn = (p["name:bn"] ?? null) as string | null;

    if (typeof p.amenity === "string" && /^(school|college|hospital|clinic)$/.test(p.amenity)) {
      if (p.amenity !== "school" && p.amenity !== "college" && name && NOT_CARE_FACILITY.test(name)) continue;
      const kind = p.amenity === "college" ? "school" : p.amenity;
      const point = representativePoint(f.geometry);
      if (point) pois.push(feature({ type: "Point", coordinates: point }, { osm_id: id, kind, name }));
    } else if (typeof p.highway === "string" && f.geometry?.type === "LineString") {
      roads.push(feature(f.geometry, { osm_id: id, highway: p.highway, name }));
    } else if (p.boundary === "administrative" && (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon")) {
      const multi: Geometry =
        f.geometry.type === "Polygon" ? { type: "MultiPolygon", coordinates: [f.geometry.coordinates] } : f.geometry;
      wards.push(
        feature(multi, {
          osm_id: id,
          admin_level: p.admin_level,
          name_en: name ?? id,
          name_bn: nameBn,
          ref: p.ref ?? null,
        }),
      );
    }
  }

  const outDir = path.join(process.cwd(), "data", "osm");
  await mkdir(outDir, { recursive: true });
  const meta = { bbox, fetched_at: new Date().toISOString(), source: "OpenStreetMap via Overpass API", license: "ODbL 1.0" };
  for (const [file, features] of [["pois", pois], ["roads", roads], ["wards", wards]] as const) {
    await writeFile(path.join(outDir, `${file}.geojson`), JSON.stringify({ type: "FeatureCollection", meta, features }));
  }

  const levels = wards.reduce<Record<string, number>>((acc, w) => {
    const lvl = String(w.properties?.admin_level);
    acc[lvl] = (acc[lvl] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `Wrote data/osm: ${pois.length} POIs (${countBy(pois, "kind")}), ${roads.length} roads, ` +
      `${wards.length} admin areas by admin_level ${JSON.stringify(levels)}`,
  );
}

function feature(geometry: Geometry, properties: Record<string, unknown>): Feature {
  return { type: "Feature", geometry, properties };
}

/** Point for a POI: the node itself, or the average of the outer ring for areas (fine at campus scale). */
function representativePoint(g: Geometry | null): Position | null {
  if (!g) return null;
  if (g.type === "Point") return g.coordinates;
  const ring = g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0][0] : null;
  if (!ring?.length) return null;
  const [sx, sy] = ring.reduce(([x, y], [px, py]) => [x + px, y + py], [0, 0]);
  return [sx / ring.length, sy / ring.length];
}

function countBy(features: Feature[], key: string): string {
  const counts: Record<string, number> = {};
  for (const f of features) counts[String(f.properties?.[key])] = (counts[String(f.properties?.[key])] ?? 0) + 1;
  return Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
