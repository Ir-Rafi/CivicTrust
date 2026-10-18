# CivicTrust Backend Contract

The frontend can build against the server actions below. They are server-only and use the Supabase service connection; browser code must not import `db()` or expose secret keys.

## Officer actions

Import from `src/app/officer/actions.ts`:

- `getOfficerQueue({ status?, issueType?, wardId?, limit? })`
- `correctIssue({ issueId, actorName, reason, issueType?, visualClass?, severity? })`
- `createWorkOrder({ issueId, assigneeType, contractorId?, ngoId?, agreedCost?, deadline?, createdBy })`
- `releaseWorkOrderPayment({ workOrderId, actorName })`

`createWorkOrder` calculates a deadline from the severity and stores the policy citation. Payment begins as `withheld`. `releaseWorkOrderPayment` only succeeds after an approved repair proof and an approved work order.

## Contractor and NGO actions

Import from `src/app/contractor/actions.ts`:

- `getContractorWorkOrders(contractorId, status?)`
- `getNgoWorkOrders(ngoId, status?)`
- `submitRepair(formData)`

The repair form must contain `photo`, `workOrderId`, `lat`, `lng`, `capturedAt`, and `actorName`. The service checks file type and size, photo freshness, capture time after work-order creation, distance within 15 metres, and Gemini before/after verification. Results are `approved`, `rejected`, or `needs_review`.

## Citizen actions

Import `submitReport` and `submitFeedback` from `src/app/citizen/actions.ts`.

`submitFeedback({ issueId, citizenName, verdict, rating?, comment? })` accepts `confirmed` or `disputed`. A dispute moves the issue back to `disputed`; confirmation moves it to `confirmed`.

## Public actions

Import from `src/app/public/actions.ts`:

- `getPublicWardStats()`
- `getPublicContractorScorecards()`

These call the database functions `ward_stats()` and `contractor_scorecards()`.

## Audit actions

Import from `src/app/audit/actions.ts`:

- `getAuditChainStatus()`
- `getAuditEntries({ entity?, entityId?, limit? })`

The chain status returns the total number of records and the first broken record ID, or `null` when the chain is intact.

## Database migration

`supabase/migrations/20261018000000_preliminary_workflow.sql` adds:

- `work_orders.agreed_cost`
- `work_orders.payment_status`
- `work_orders.payment_released_at`
- payment release enforcement
- repair distance calculation
- contractor scorecard aggregation

Apply it with the Supabase CLI after starting or linking the target database:

```bash
pnpm exec supabase db push
```

The local migration has not been applied automatically by the application. Run the command above before using the new workflow against the database.
