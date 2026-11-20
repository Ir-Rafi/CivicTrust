# Impact: expected outcomes and measurement

The preliminary submission presents **expected outcomes with their KPIs**, as Section 9.2 of the
[participant guide](../AIBC_Participants_Guide_261015_143157.pdf) allows ("KPIs or expected
outcomes"). Figures are reported only when the live system has measured them, with their sample
size and date window. Field accuracy, time savings and financial savings will be measured in the city pilot.

## Where the figures come from

| Source | What it measures | How to run it |
|---|---|---|
| **`/impact` page** (public, on the site) | Live KPIs from the database and audit log, recomputed every time the page opens, each with its sample size and a status | Open `https://<site>/impact` |
| **`pnpm kpi`** | The same figures in the terminal, from the same code (`web/src/lib/kpi.ts`) | `pnpm kpi [--since YYYY-MM-DD] [--json out.json]` |
| **`pnpm eval:photos`** | Accuracy of the vision model on photos labelled by people | `pnpm eval:photos <folder> [--interval-ms 15000] [--json out.json]` |
| **Automated tests** | Software rules: severity formula, repair verdicts, geography, time budgets, KPI maths (80 tests) | `pnpm test` |

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
| Faster triage | AI classification, explainable severity score and a ranked officer queue | Photo to ranked issue, median and p90 | **Early data:** median 11.1 s, p90 13.9 s (n=6) |
| Less duplicate work | Nearby search (25 m) and visual comparison before merging repeat reports | Share of reports merged into an existing issue | **Early data:** 28.6% (2 of 7 reports) |
| Fewer false repair closures | Location, freshness and before/after checks; unsure results go to an officer | AI-approved repairs later overturned | Awaiting the first AI-approved repair; in the 20 Nov run, 2 of 2 invalid repair photos were correctly rejected |
| Accountable spending | Payment withheld until the repair is approved; enforced in the database | Payments released with an approved repair | Payment gate active: ৳50,000 held on 2 work orders until a repair is approved |
| Traceable decisions | Every step written to a hash-chained, append-only audit log | Records with their audit entry | **Early data:** 100% (19 of 19 records); audit chain of 188 entries intact |
| Resilient AI | Groq primary with GLM fallback; failures logged and routed to people | Gemini success; Groq/GLM fallback share; failed comparisons | **Early data:** photo analysis completed in 41 of 59 runs, and every other run ended safely with a clear retry message and nothing stored; explanations by Groq 4 of 4; duplicate comparisons 2 of 2 completed |
| Visible progress for citizens | Public tracker, update log and per-area figures | Citizens who can find their issue's status (user study) | Planned for the city pilot (user study) |

Figures come from `pnpm kpi` and the `/impact` page (which agree), for all records from 17 Oct to
20 Nov 2026, 20:10 Bangladesh time: 5 issues, 7 reports, 2 work orders and 3 repair photos. Every
record comes from desktop tests with sample photos at demo locations. Figures are labelled early
data until 10 or more records stand behind them. Any numerical target is labelled as a
team-proposed target, separate from results.

## Measurement run

A run can be done entirely from a laptop on the live site. The report form accepts a photo file
and offers **demo spots** inside the pilot area; such reports are recorded with location source
`demo`, so they are never mistaken for field GPS.

**Before starting**

1. Working Gemini keys in `web/.env.local` and on Vercel: the pool of free keys from different
   projects, with backup vision models (`GEMINI_API_KEYS`, `GEMINI_VISION_FALLBACK_MODELS`).
2. Set `KPI_SINCE` to the day of the run, so earlier test attempts are excluded.
3. Prepare 10–15 photos the team may use: its own street photos, or openly licensed photos with
   their source and licence noted. Include a few non-civic photos and two photos of the same problem.

**Steps**

| Case | Action | Record |
|---|---|---|
| Report | Citizen: photo and demo spot, then submit | Issue type, severity and Bangla reason |
| Duplicate | Second photo of the same problem at the same demo spot | Merged into the first issue, or a new issue |
| Not civic | A photo of a room or shop front | Rejected, nothing stored |
| Officer | Filter the queue, correct an AI result with a reason, assign with cost | Table and map update; policy citation and deadline shown |
| Repair | Contractor uploads an after-photo using the work-site demo location | Not approved automatically (location not measured); sent to the officer |
| Review | Officer approves or rejects; release payment if approved | Verdict and payment status |
| Citizen | Confirm or dispute the fixed issue | Status changes; a dispute blocks payment |
| Public | Open `/public`, `/audit` and `/impact` | Completed steps appear; audit chain intact; KPIs updated |

Keep a screenshot or recording timestamp for each case. Every case stays in the record.

**Planned for the city pilot:** on-site GPS accuracy, camera authenticity, real repair quality,
model accuracy on Dhaka streets and public-spending savings.

### Run on 20 November 2026

On the main site (`civictrust-eight.vercel.app`), 19:39–20:05 Bangladesh time, in Bangla, from a
desktop browser. Photos were openly licensed images from Wikimedia Commons (CC0 or public domain,
plus one CC BY-SA 2.0), all at demo locations. Seven Gemini calls in total.

| Case | Result |
|---|---|
| Report | New issue #CT-18 at Panthapath in 12 s: pothole, 95% confidence, severity 7/10 with every factor shown, reason in Bangla and English |
| Duplicate | A second pothole photo at Road 16 merged into #CT-16 in 8.9 s (3 reports; severity 9/10, report bonus capped at +1) |
| Not civic | A cat photo was rejected in 7.7 s ("not a public infrastructure issue"); nothing stored |
| Repair in progress | A photo of a crew filling a pothole was recognised as maintenance work, not a new problem |
| Resilience | During a short Gemini slowdown the form showed a clear retry message and stored nothing; the retry succeeded |
| Officer | #CT-18 appeared in the queue and on the map. A correction with no change, then with no reason, was refused; with a reason, severity moved from 7 to 9 and history went from 2 to 4 entries |
| Assignment | WO-18 to Demo Contractor A, ৳25,000; 48-hour deadline from the cited policy section (critical band, 77% match); payment withheld |
| Repair | The unrepaired photo was rejected (same place, not resolved, 100% confidence); a patched road from another place was rejected as a different location. Payment stayed withheld both times |
| Review, payment, citizen | Covered by earlier team runs: the audit log records 15 repair reviews, 5 payment releases, 7 confirmations and 10 disputes |
| Public | `/public` showed #CT-18 with report and assignment dates, the update log and scorecards, with no names or coordinates; `/audit` reported 188 records verified; `/impact` matched `pnpm kpi` |

## Labelled-photo evaluation (optional)

`pnpm eval:photos` uses the same Gemini calls and approval rule as the app. Labels must be set by
people before the model runs; the folder name is the correct answer.

```text
<folder>/issues/<label>/*.jpg                    label: pothole | road_crack | garbage | open_drain | waterlogging | other | not_civic
<folder>/repairs/<expected>/<pair>/before.jpg    expected: fixed | not_fixed | different_place
<folder>/repairs/<expected>/<pair>/after.jpg
```

Keep the photos out of git and record each photo's source and licence. Report sample sizes
alongside accuracy. Repair pairs test the visual judgement only: location and
freshness are assumed valid.

## Summary

> CivicTrust is designed to shorten triage, cut duplicate case handling, prevent payment for
> unfinished repairs and make every decision traceable. Live figures for each of these are computed
> from the system on the public `/impact` page, with sample sizes. The prototype was tested on a
> desktop with sample photos at demo locations; field GPS, real repair quality and citizen impact
> will be measured in a pilot with the city. In the prototype, payment release records an
> eligible status; bank transfer integration is part of the city rollout.
