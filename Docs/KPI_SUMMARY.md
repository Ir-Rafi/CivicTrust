# Impact: expected outcomes and measurement

The preliminary submission presents **expected outcomes with their KPIs**, as Section 9.2 of the
[participant guide](../AIBC_Participants_Guide_261015_143157.pdf) allows ("KPIs or expected
outcomes"). Figures are reported only when the live system has measured them, with their sample
size and date window. No field accuracy, time saving or financial saving is claimed.

## Where the figures come from

| Source | What it measures | How to run it |
|---|---|---|
| **`/impact` page** (public, on the site) | Live KPIs from the database and audit log, recomputed every time the page opens, each with its sample size and a status | Open `https://<site>/impact` |
| **`pnpm kpi`** | The same figures in the terminal, from the same code (`web/src/lib/kpi.ts`) | `pnpm kpi [--since YYYY-MM-DD] [--json out.json]` |
| **`pnpm eval:photos`** | Accuracy of the vision model on photos labelled by people | `pnpm eval:photos <folder> [--interval-ms 15000] [--json out.json]` |
| **Automated tests** | Software rules: severity formula, repair verdicts, geography, time budgets, KPI maths (36 tests) | `pnpm test` |

**Status labels on `/impact`:** *No data yet* (no records), *Early data* (fewer than 10 records)
and *Measured* (10 or more). Outcomes that need a real pilot are shown as *Not measured*.

**Date window:** to count only a test run, set `KPI_SINCE=YYYY-MM-DD` (Dhaka date) in
`web/.env.local` and redeploy, or open `/impact?since=YYYY-MM-DD`. Without a window, all records count.

**Counting rules:** AI events (photo analyses, explanations, duplicate comparisons, timings) count
every pipeline run in the window, including runs whose test issue was later deleted. Audit
completeness compares records that still exist with their audit entries.

## Expected outcomes and KPIs

| Expected outcome | How CivicTrust delivers it | KPI | Current result |
|---|---|---|---|
| Faster triage | AI classification, explainable severity score and a ranked officer queue | Photo to ranked issue, median and p90 | Not yet measured |
| Less duplicate work | Nearby search (25 m) and visual comparison before merging repeat reports | Share of reports merged into an existing issue | Not yet measured |
| Fewer false repair closures | Location, freshness and before/after checks; unsure results go to an officer | AI-approved repairs later overturned | Not yet measured |
| Accountable spending | Payment withheld until the repair is approved; enforced in the database | Payments released with an approved repair | Not yet measured |
| Traceable decisions | Every step written to a hash-chained, append-only audit log | Records with their audit entry | Not yet measured |
| Resilient AI | Groq primary with GLM fallback; failures logged and routed to people | Gemini success; Groq/GLM fallback share; failed comparisons | Not yet measured |
| Visible progress for citizens | Public tracker, update log and per-area figures | Citizens who can find their issue's status (user study) | Not measured (needs a pilot) |

Replace "Not yet measured" with the figure from `/impact`, its sample size and the date window,
e.g. *"14.2 s median, p90 22.0 s (n=12, 25–26 Oct, desktop test with sample photos)"*.
Any numerical target must be labelled as a team-proposed target, separate from results.

## Measurement run

A run can be done entirely from a laptop on the live site. The report form accepts a photo file
and offers **demo spots** inside the pilot area; such reports are recorded with location source
`demo`, so they are never mistaken for field GPS.

**Before starting**

1. A paid Gemini key in `web/.env.local` and on Vercel. On the free key, photo analysis often
   fails with "high demand" (503) or rate limits (429), which would distort the figures.
2. Set `KPI_SINCE` to the day of the run, so earlier test attempts are excluded.
3. Prepare 10–15 photos the team may use: its own street photos, or openly licensed photos with
   their source and licence noted. Include a few non-civic photos and two photos of the same problem.

**Steps**

| Case | Action | Record |
|---|---|---|
| Report | Citizen: photo and demo spot, then submit | Issue type, severity, Bangla reason, or the exact error |
| Duplicate | Second photo of the same problem at the same demo spot | Merged into the first issue, or a new issue |
| Not civic | A photo of a room or shop front | Rejected, nothing stored |
| Officer | Filter the queue, correct an AI result with a reason, assign with cost | Table and map update; policy citation and deadline shown |
| Repair | Contractor uploads an after-photo using the work-site demo location | Not approved automatically (location not measured); sent to the officer |
| Review | Officer approves or rejects; release payment if approved | Verdict and payment status |
| Citizen | Confirm or dispute the fixed issue | Status changes; a dispute blocks payment |
| Public | Open `/public`, `/audit` and `/impact` | Completed steps appear; audit chain intact; KPIs updated |

Keep a screenshot or recording timestamp for each case. Failed cases stay in the record.

**What a desktop run does not show:** on-site GPS accuracy, camera authenticity, real repair
quality, model accuracy on Dhaka streets, or public-spending savings. These remain planned for a pilot.

## Labelled-photo evaluation (optional)

`pnpm eval:photos` uses the same Gemini calls and approval rule as the app. Labels must be set by
people before the model runs; the folder name is the correct answer.

```text
<folder>/issues/<label>/*.jpg                    label: pothole | road_crack | garbage | open_drain | waterlogging | other | not_civic
<folder>/repairs/<expected>/<pair>/before.jpg    expected: fixed | not_fixed | different_place
<folder>/repairs/<expected>/<pair>/after.jpg
```

Keep the photos out of git and record each photo's source and licence. Report sample sizes and
failed calls alongside accuracy. Repair pairs test the visual judgement only: location and
freshness are assumed valid.

## Submission wording

> CivicTrust is designed to shorten triage, cut duplicate case handling, prevent payment for
> unfinished repairs and make every decision traceable. Live figures for each of these are computed
> from the system on the public `/impact` page, with sample sizes. The prototype was tested on a
> desktop with sample photos at demo locations; field GPS, real repair quality and citizen impact
> will be measured in a pilot with the city. Payment release in the prototype records a status;
> it does not transfer money.
