// Turns a reverse-geocoded OpenStreetMap address into the parts people use for an address in
// Dhaka: road, neighbourhood/area, city. Pure, so it is testable and safe to use in the browser.

/** A place, reduced to what people use in an address. */
export type PlaceName = {
  road: string | null;
  houseNumber: string | null;
  /** Neighbourhood/area names, most specific first, without repeats. */
  area: string[];
  city: string | null;
  /** One stable area per place for grouping statistics (suburb level), e.g. "Lalmatia". */
  zone: string | null;
};

export type OsmAddress = Partial<Record<string, string>>;

const ROAD_KEYS = ["road", "pedestrian", "footway", "path"] as const;
const AREA_KEYS = ["neighbourhood", "quarter", "suburb", "residential", "city_district"] as const;
const CITY_KEYS = ["city", "town", "village", "county"] as const;
// Suburb is the level people name ("Lalmatia", "Gulshan"); finer levels only when it is missing.
const ZONE_KEYS = ["suburb", "city_district", "quarter", "neighbourhood", "residential"] as const;
const MAX_AREA_PARTS = 2;

const first = (address: OsmAddress, keys: readonly string[]) => keys.map((k) => address[k]).find((v): v is string => !!v) ?? null;

/**
 * Shop and building names are deliberately left out: in Bangla mode OSM falls back to whatever
 * name it has, sometimes in another script (a restaurant came back in Arabic).
 */
export function toPlaceName(address: OsmAddress | null | undefined): PlaceName | null {
  if (!address) return null;
  const road = first(address, ROAD_KEYS);
  const area: string[] = [];
  for (const key of AREA_KEYS) {
    const value = address[key];
    if (value && !area.includes(value) && area.length < MAX_AREA_PARTS) area.push(value);
  }
  const cityName = first(address, CITY_KEYS);
  const city = cityName && !area.includes(cityName) ? cityName : null;
  if (!road && area.length === 0 && !city) return null;
  return { road, houseNumber: address.house_number ?? null, area, city, zone: first(address, ZONE_KEYS) };
}

/**
 * Two display lines: the road (with the house number only when the fix is precise enough for it
 * to be the right house) and the area + city.
 */
export function placeLines(name: PlaceName | null, opts: { includeHouse: boolean }): { primary: string | null; secondary: string | null } {
  if (!name) return { primary: null, secondary: null };
  const primary = name.road ? (opts.includeHouse && name.houseNumber ? `${name.houseNumber}, ${name.road}` : name.road) : null;
  const rest = [...name.area, name.city].filter((v): v is string => !!v);
  return { primary, secondary: rest.length ? rest.join(", ") : null };
}
