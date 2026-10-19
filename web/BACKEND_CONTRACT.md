# CivicTrust Backend Contract

The frontend can build against the server actions below. They are server-only and use the Supabase service connection; browser code must not import `db()` or expose secret keys.

## Officer actions

Import from `src/app/officer/actions.ts`:

- `getOfficerQueue({ status?, issueType?, wardId?, limit? })`: each item includes `lat` and `lng` for the map (officer screens only).
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

The repair form must contain `photo`, `workOrderId`, `lat`, `lng`, and `capturedAt` (ISO 8601). The service checks file type and size, photo freshness, capture time after work-order creation, distance within 15 metres, and Gemini before/after verification against the issue's first citizen photo. Results:

- `rejected`: a hard check failed, or the AI is confident the location differs or the problem is not fixed. Payment stays `withheld`; the crew can submit again on the same work order.
- `approved`: the AI is confident it is the same place and the problem is resolved. Payment becomes `eligible` and the issue is `fixed`.
- `needs_review`: the AI says partial or unclear, has low confidence, or was unavailable. The work order moves to `submitted` and waits for `reviewRepairProof`; the crew cannot resubmit meanwhile.

## Citizen actions

Import `submitReport` and `submitFeedback` from `src/app/citizen/actions.ts`.

`submitFeedback({ issueId, verdict, rating?, comment? })` accepts `confirmed` or `disputed`. It works only when the issue is `fixed`, and only for a citizen who reported it. Confirmation moves the issue to `confirmed`. A dispute moves it to `disputed`, puts the work order back to `submitted` for officer review, and withholds payment; if payment was already released, the dispute is still recorded and counted on the scorecard.

## Public actions

Import from `src/app/public/actions.ts`:

- `getPublicWardStats()`
- `getPublicContractorScorecards()`

- `getPublicIssues(limit?)`: every reported problem, newest first, with `issue_type`, `place` (`road` name and nearest named school/hospital within 500 m as `landmark`), `stage` (`reported`, `assigned`, `fixed`, `confirmed`, `disputed`), `report_count`, and the `reported_at`, `assigned_at` and `fixed_at` dates.
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
