# CivicTrust Backend Contract

The frontend can build against the server actions below. They are server-only and use the Supabase service connection; browser code must not import `db()` or expose secret keys.

## Officer actions

Import from `src/app/officer/actions.ts`:

- `getOfficerQueue({ status?, issueType?, wardId?, area?, limit? })`: each item includes `lat` and `lng` for the map (officer screens only) and `area_en` / `area_bn`, the OpenStreetMap area (suburb level, e.g. Lalmatia) recorded when the issue was reported. `area` filters on `area_en`.
- `getIssueHistory(issueId)`: every audit entry for the issue and its work orders, oldest first (report, AI assessment, corrections, assignment, repair evidence, reviews, citizen feedback, payment, NGO offers). Includes names and comments, so officers only.
- `getIssueOffers(issueId)`: NGOs and volunteer groups that offered to fix the issue (`ngoName`, `note`, `createdAt`).
- `correctIssue({ issueId, reason, issueType?, visualClass?, severity? })`
- `createWorkOrder({ issueId, assigneeType, contractorId?, ngoId?, agreedCost?, deadline? })`
- `reviewRepairProof({ workOrderId, decision: "approved" | "rejected", reason })`
- `releaseWorkOrderPayment({ workOrderId })`

The actor name in the audit log is set on the server from the demo persona; the browser does not send it.

`correctIssue` recomputes the severity breakdown with the corrected photo class. An explicit `severity` is stored as `severity_components.officer_score` and shown as the issue's severity; later duplicate reports do not overwrite it.

`createWorkOrder` calculates a deadline from the severity and stores the policy citation. Payment begins as `withheld`. It fails if the issue already has an open, in-progress or submitted work order; an earlier rejected order is cancelled when a new one is created.

`reviewRepairProof` decides a work order in `submitted` status: a repair the AI was unsure about, or an approved repair a citizen disputed. Approving makes payment `eligible` and marks the issue `fixed`; rejecting withholds payment and sends the issue back to `assigned` so the crew can resubmit.

`releaseWorkOrderPayment` only succeeds when the work order is approved, its latest repair proof is approved (by the AI or an officer), and the issue is `fixed` or `confirmed`, not `disputed`. A database trigger enforces the same rule.

## Contractor and NGO actions

Import from `src/app/contractor/actions.ts`:

- `getContractorWorkOrders(contractorId, status?)`
- `getNgoWorkOrders(ngoId, status?)`
- `submitRepair(formData)`

NGO only, from `src/app/ngo/actions.ts`: `offerToHelp({ issueId, ngoId, note? })` records that the group can fix an open, unassigned issue. Repeating it is a no-op (`alreadyOffered: true`). The officer sees the offers in the issue detail and decides by assigning.

The repair form must contain `photo`, `workOrderId`, `lat`, `lng`, `capturedAt` (ISO 8601) and `locationSource`: `gps` for a measured fix, `site` when the "work site" demo option sent the issue's own coordinates. A `site` repair is recorded as such and can be rejected or sent to an officer, but is never approved automatically, so payment can't unlock on an unmeasured location. The service checks file type and size, photo freshness, capture time after work-order creation, distance within 15 metres, and Gemini before/after verification against the issue's first citizen photo. Results:

- `rejected`: a hard check failed, or the AI is confident the location differs or the problem is not fixed. Payment stays `withheld`; the crew can submit again on the same work order.
- `approved`: the AI is confident it is the same place and the problem is resolved. Payment becomes `eligible` and the issue is `fixed`.
- `needs_review`: the AI says partial or unclear, has low confidence, or was unavailable. The work order moves to `submitted` and waits for `reviewRepairProof`; the crew cannot resubmit meanwhile.

## Citizen actions

Import `submitReport` and `submitFeedback` from `src/app/citizen/actions.ts`.

`submitFeedback({ issueId, verdict, rating?, comment? })` accepts `confirmed` or `disputed`. It works only when the issue is `fixed`, and only for a citizen who reported it. Confirmation moves the issue to `confirmed`. A dispute moves it to `disputed`, puts the work order back to `submitted` for officer review, and withholds payment; if payment was already released, the dispute is still recorded and counted on the scorecard.

## Public actions

Import from `src/app/public/actions.ts`:

- `getPublicWardStats()`: per official ward; while no ward boundaries are loaded, per OpenStreetMap area instead (rows with a negative `ward_id`, name `null` for issues without a recorded area).
- `getPublicContractorScorecards()`

- `getPublicIssues(limit?)`: every reported problem, newest first, with `issue_type`, `place` (`road` name, `area` `{ en, bn }` from OpenStreetMap, and nearest named school/hospital within 500 m as `landmark`), `stage` (`reported`, `assigned`, `fixed`, `confirmed`, `disputed`), `report_count`, and the `reported_at`, `assigned_at` and `fixed_at` dates.
- `getPublicLog(limit?)`: plain-language update log, newest first. Each entry has `kind` (`reported`, `assigned`, `fixed`, `not_accepted`, `disputed`, `confirmed`), `verified_by` (`ai` or `officer` for fixes), the time, the issue's type and place, and the audit record `id`.

Both return no coordinates, reporter names, comments, costs or AI internals. The log is read from the hash-chained audit log, so it updates by itself with every workflow action; rejected or unsure repair attempts and internal actions (AI scores, overrides, payments) are not shown. The mapping rules are in `src/lib/public-log-rules.ts` with tests.

The ward stats and scorecards call the database functions `ward_stats()` and `contractor_scorecards()`. `on_time_rate` is the share of due jobs whose approved repair was submitted by the deadline; unfinished jobs past their deadline count as late. It is `null` when no job is due yet.

## Audit actions

Import from `src/app/audit/actions.ts`:

- `getAuditChainStatus()`
- `getAuditEntries({ entity?, entityId?, limit? })`

The chain status returns the total number of records and the first broken record ID, or `null` when the chain is intact. Officers get full entries; every other role gets citizen names replaced with "Citizen" and comments hidden.

## Database migration

`supabase/migrations/20261018000000_preliminary_workflow.sql` adds:

- `work_orders.agreed_cost`
- `work_orders.payment_status`
- `work_orders.payment_released_at`
- payment release enforcement
- repair distance calculation
- contractor scorecard aggregation

`supabase/migrations/20261018120000_workflow_fixes.sql` adds officer review fields on `repair_proofs`, map coordinates on `issues`, the dispute-aware payment gate, the on-time rate fix, and closes the new functions to browser roles.

`supabase/migrations/20261018130000_fix_lat_lng_shadowing.sql` renames those coordinates to `issues.location_lat`/`location_lng` (the queue still returns them as `lat`/`lng`). Columns named `lat`/`lng` had shadowed the parameters of `nearby_open_issues()` and `repair_distance_to_issue()`, so every distance came out as 0 m.

`supabase/migrations/20261018140000_scorecard_keeps_failed_jobs.sql` links each citizen dispute to its work order and keeps reassigned (cancelled) jobs on the original contractor's scorecard: they count as assigned, and as rejected if their last repair was rejected.

Apply them with the Supabase CLI after starting or linking the target database:

```bash
pnpm exec supabase db push
```

The local migration has not been applied automatically by the application. Run the command above before using the new workflow against the database.

## Report pipeline timing and measurements

`submitReport` runs the AI steps inside a 50 s budget (the page allows 60 s): photo analysis up to 30 s, each duplicate comparison up to 12 s, explanation up to 10 s per provider. Gemini calls have no automatic retries. A failed or timed-out analysis returns `{ error: "ai_busy" }` (shown as "The AI is busy right now…") and is recorded as `report_failed`; a failed duplicate comparison files the report as a new issue; a failed explanation leaves the breakdown to explain the score.

The `issue_assessed` and `report_merged` audit entries carry `timing` (total and per step, in ms), `explanation_provider` (`groq`, `glm` or `null`) and duplicate-check counts. `pnpm kpi` turns these into the §8 measurements; `pnpm eval:photos <folder>` measures accuracy on a labelled photo set.

`supabase/migrations/20261019120000_areas_and_ngo_offers.sql` adds `issues.area_en` / `area_bn`, the `area_stats()` function and the `ngo_offers` table (RLS on, server role only). `pnpm backfill:areas` fills the area for issues reported before it existed.
