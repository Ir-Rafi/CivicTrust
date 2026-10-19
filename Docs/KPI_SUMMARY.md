# KPI summary: measured results and targets

Requirements §8 asks for measured figures, kept separate from targets. This file says how each
figure is measured, how to collect the field data, and where the results go. **Only figures in
the "Measured" table may appear in the video or the submission.**

## Status (19 Oct 2026)

Nothing is measured yet. The live database holds one real issue, and today's runs were affected
by the free Gemini quota and a Gemini outage (503 "high demand"), so the current numbers describe
test conditions, not the product. Measure after the field shoot, with the paid Gemini key.

## Measured (fill in after the field shoot)

| KPI (requirements §8) | Result | Sample | How it was measured | Date |
|---|---|---|---|---|
| Issue classification accuracy | — | — photos | `pnpm eval:photos <folder>` | — |
| Repair verification accuracy | — | — pairs | `pnpm eval:photos <folder>` | — |
| False-closure rate on test pairs (not fixed, but approved) | — | — pairs | `pnpm eval:photos <folder>` | — |
| Duplicate merge rate | — | — reports | `pnpm kpi --since <shoot date>` | — |
| Time from submission to ranked issue (median, p90) | — | — reports | `pnpm kpi --since <shoot date>` | — |
| Audit-record completion rate | — | — records | `pnpm kpi --since <shoot date>` | — |
| AI provider success and fallback rates | — | — calls | `pnpm kpi --since <shoot date>` | — |

Copy the numbers exactly as the scripts print them, with the sample size. Add `--json results.json`
to keep the raw output, and keep that file with the photo set.

## Targets (proposed; the team confirms them, and they are labelled as targets wherever they appear)

| KPI | Target for the pilot |
|---|---|
| Issue classification accuracy | ≥ 85% on the field set |
| False-closure rate | 0 approved repairs that were not fixed |
| Time from submission to ranked issue | median ≤ 20 s |
| Audit-record completion | 100% |
| Median fix time, citizen confirmation rate, overdue share per area | Measured after launch, not in the preliminary |

## Field shoot protocol (Dhanmondi pilot area)

1. **Issue photos (at least 30).** Real potholes, road cracks, garbage, open drains and
   waterlogging, plus about 5 photos that are not civic problems (a shop front, a person, a room).
   Use the phone camera, daylight and some evening shots, different angles. No faces or number
   plates in frame.
2. **Before/after pairs (at least 5 fixed, plus 5 not fixed).** Same spot, same angle where
   possible. "Fixed" can be rubbish cleared away; "not fixed" is the same scene again or a
   different spot.
3. **Live reports.** Also submit 10–15 of the issues through the app on the phone (GPS on, or the
   manual pin) so `pnpm kpi` measures duplicates, timing and AI reliability on real use. Report a
   few problems twice from nearby to test the duplicate filter.
4. **Folder layout** for `pnpm eval:photos` (keep the photos out of git):

   ```
   field-set/issues/<label>/*.jpg     label = pothole | road_crack | garbage | open_drain | waterlogging | other | not_civic
   field-set/repairs/<expected>/<pair>/before.jpg + after.jpg     expected = fixed | not_fixed | different_place
   ```

   The folder name is the correct answer; label carefully, because the accuracy is only as good as
   the labels.

## Running the measurements

```bash
cd web
pnpm eval:photos ../field-set --json eval-results.json
pnpm kpi --since 2026-10-24 --json kpi-results.json     # use the shoot date
```

Both need a Gemini key with enough quota: each photo or pair is one AI request.
