# Ward boundaries (needed for the public portal's per-ward numbers)

OpenStreetMap does not have Dhaka City Corporation ward boundaries (it stops at
"Dhaka Metropolitan", admin_level 6). HDX's Bangladesh COD-AB admin level 4 is
thanas/unions, not city-corporation wards.

**Team task (BA / Data):** find a lawful source for the pilot wards, for example
DNCC/DSCC published ward maps or a Bangladesh Bureau of Statistics release, and
record its licence on the `/data` page.

Save as `data/wards/wards.geojson`:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "code": "DSCC-15", "name_en": "Ward 15", "name_bn": "ওয়ার্ড ১৫", "city": "DSCC" },
      "geometry": { "type": "Polygon", "coordinates": [[[90.37, 23.74], "..."]] }
    }
  ]
}
```

Then run `pnpm seed:load`. Until then, issues still work; `ward_id` is left empty.
