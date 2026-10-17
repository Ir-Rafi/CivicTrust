/**
 * Load reference data into Supabase:
 *   data/osm/pois.geojson, data/osm/roads.geojson  (from `pnpm seed:fetch`)
 *   data/wards/wards.geojson                        (ward boundaries from an official source, optional)
 *
 *   pnpm seed:load
 *
 * Wards file: FeatureCollection of Polygon/MultiPolygon with properties
 *   { code: string, name_en: string, name_bn?: string, city?: string }
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { FeatureCollection, Geometry, Position } from "geojson";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const root = process.cwd();

async function readCollection(rel: string): Promise<FeatureCollection | null> {
  const file = path.join(root, rel);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
}

async function upsertInBatches(table: string, rows: Record<string, unknown>[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
  const pois = await readCollection("data/osm/pois.geojson");
  const roads = await readCollection("data/osm/roads.geojson");
  if (!pois || !roads) throw new Error("Run `pnpm seed:fetch` first");

  console.log("Loading reference data ...");
  // The OSM extract is the source of truth: replace, so features dropped upstream disappear.
  for (const table of ["pois", "roads"]) {
    const { error } = await supabase.from(table).delete().gte("id", 0);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  await upsertInBatches(
    "pois",
    pois.features.map((f) => ({
      osm_id: f.properties!.osm_id,
      kind: f.properties!.kind,
      name: f.properties!.name,
      location: ewkt(f.geometry),
    })),
    "osm_id",
  );
  await upsertInBatches(
    "roads",
    roads.features.map((f) => ({
      osm_id: f.properties!.osm_id,
      highway: f.properties!.highway,
      name: f.properties!.name,
      geom: ewkt(f.geometry),
    })),
    "osm_id",
  );

  const wards = await readCollection("data/wards/wards.geojson");
  if (wards) {
    await upsertInBatches(
      "wards",
      wards.features.map((f) => ({
        code: String(f.properties!.code),
        name_en: f.properties!.name_en,
        name_bn: f.properties!.name_bn ?? null,
        city: f.properties!.city ?? null,
        boundary: ewkt(
          f.geometry.type === "Polygon" ? { type: "MultiPolygon", coordinates: [f.geometry.coordinates] } : f.geometry,
        ),
      })),
      "code",
    );
  } else {
    console.log("  wards: skipped (no data/wards/wards.geojson yet; see data/wards/README.md)");
  }
  console.log("Done.");
}

/** GeoJSON geometry -> EWKT string that PostGIS casts into geometry/geography columns. */
function ewkt(g: Geometry): string {
  const pt = (p: Position) => `${p[0]} ${p[1]}`;
  const ring = (r: Position[]) => `(${r.map(pt).join(", ")})`;
  switch (g.type) {
    case "Point":
      return `SRID=4326;POINT(${pt(g.coordinates)})`;
    case "LineString":
      return `SRID=4326;LINESTRING(${g.coordinates.map(pt).join(", ")})`;
    case "MultiPolygon":
      return `SRID=4326;MULTIPOLYGON(${g.coordinates.map((poly) => `(${poly.map(ring).join(", ")})`).join(", ")})`;
    default:
      throw new Error(`Unsupported geometry ${g.type}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
