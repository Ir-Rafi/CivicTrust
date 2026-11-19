# n8n: daily overdue-repair check

A self-hosted [n8n](https://n8n.io) workflow that runs CivicTrust's overdue-repair check every day
at 09:00 Dhaka time. The check finds work orders past their deadline without an approved repair,
records each one once in the audit log, shows it in the public update log and flags it for the
ward officer. The logic lives in the app (`GET /api/automation/overdue`); n8n schedules it, retries
failed calls (3 tries, 5 s apart) and keeps a run history.

Vercel Cron (`web/vercel.json`) calls the same endpoint daily on the hosted demo. Running both is
safe: each overdue order is recorded once, however often the check runs.

## Run it

Needs Docker and the app's `CRON_SECRET`.

```sh
cd automation/n8n
export CIVICTRUST_URL=https://civic-trust-siuu.vercel.app
export CIVICTRUST_CRON_SECRET=...        # same value as CRON_SECRET in the app
docker compose up -d
docker compose exec n8n n8n import:workflow --input=/workflows/overdue-check.workflow.json
```

Then open <http://localhost:5678>, create the owner account, open
"CivicTrust: daily overdue-repair check" and switch it to **Active**.

## Test without writing anything

Set `CIVICTRUST_DRY_RUN=1` before `docker compose up`. The app then reports what it would record
(`"to_record"`) and writes nothing. Run the workflow once from the editor ("Run now (manual test)"),
or from the command line:

```sh
docker compose exec n8n n8n execute --id=CivicTrustOverdu
```

A successful run returns, for example:

```json
{ "checked_at": "…", "dry_run": true, "overdue": 1, "to_record": 1, "newly_recorded": 0 }
```

## Security

- The endpoint refuses requests without `Authorization: Bearer <CRON_SECRET>`.
- Only `CIVICTRUST_URL`, `CIVICTRUST_CRON_SECRET` and `CIVICTRUST_DRY_RUN` are passed into the
  container; the workflow file contains no secrets.
- n8n listens on port 5678 on this machine only. Put it behind authentication before exposing it.
