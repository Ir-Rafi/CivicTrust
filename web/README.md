# CivicTrust: developer guide

Citizens report civic issues with photos; AI classifies them and supports an explainable urgency
score; officers assign work; repair checks or officer review control closure and payment eligibility.
Plan and judging alignment:
[`../PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md).

Backend service contracts for the officer, contractor, citizen, public, and audit flows are documented in [`BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md).
The system architecture diagram and prototype limits are in the [root README](../README.md#architecture).

## Stack

Next.js 16 · Supabase (Postgres + PostGIS + pgvector, Storage) · Gemini (vision, embeddings) ·
Groq (primary bilingual text) + GLM (fallback) + optional local Ollama · Mastra (officer assistant) ·
Leaflet + OpenStreetMap.

## Setup

Requires Node 24 (`nvm use` reads `../.nvmrc`) and pnpm.

```bash
pnpm install
cp .env.example .env.local        # fill in keys
```

### Database: pick one

**Local (needs Docker Desktop running):**

```bash
pnpm db:start                     # first run downloads Supabase images
pnpm exec supabase status         # copy API URL + secret key into .env.local
```

`db:start` applies `supabase/migrations` and `supabase/seed.sql`. Use `pnpm db:reset` to rebuild.

**Hosted Supabase project:**

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push        # applies migrations
```

Then run `supabase/seed.sql` in the SQL editor, and put the project URL and secret key in `.env.local`.

### Reference data and knowledge base

```bash
pnpm seed:fetch     # OSM schools/hospitals/roads for the pilot bbox -> data/osm (already fetched)
pnpm seed:load      # load data/osm (+ data/wards if present) into the database
pnpm seed:policy    # embed data/policy/*.md into policy_chunks (needs GEMINI_API_KEY)
pnpm backfill:areas # fill the OpenStreetMap area of issues reported before areas were recorded
```

Roads and facilities support location context and severity scoring. Official ward boundaries are
optional; until they are loaded, public statistics group issues by recorded OpenStreetMap area.
The policy files are team-authored pilot rules, not official city regulations.

### Measurements

```bash
pnpm kpi [--since YYYY-MM-DD] [--json kpi.json]          # live KPIs from the database and audit log
pnpm eval:photos <folder> [--interval-ms 15000] [--json eval.json]   # accuracy on a labelled photo set (layout in the script header)
pnpm eval:local-models qwen2.5:3b llama3.2:3b   # local Ollama models vs Groq on the explanation prompt's rules
pnpm smoke:agent ["Which repairs are late?"]    # ask the officer assistant real questions (read-only)
```

The `/impact` page shows the same KPIs as `pnpm kpi` (both use `src/lib/kpi.ts`), with sample
sizes. Its default date window comes from the optional `KPI_SINCE` setting; `/impact?since=YYYY-MM-DD`
overrides it. Method and wording: [`../Docs/KPI_SUMMARY.md`](../Docs/KPI_SUMMARY.md).

### Run

The read-only MCP endpoint is `/api/mcp`. Configure a separate `MCP_AUTH_TOKEN`, start the app,
then run `pnpm smoke:mcp`. Tool inventory, client setup, access limits and deployment instructions:
[`../Docs/MCP_GUIDE.md`](../Docs/MCP_GUIDE.md).

```bash
pnpm dev            # http://localhost:3000
curl localhost:3000/api/health   # shows which integrations are configured
```

Citizen reports use GPS by default. **Choose the spot on the map yourself** enables manual
selection by tapping or dragging a pin inside the Dhanmondi pilot boundary. Users can return
to GPS at any time; a manual pin also works when device location is unavailable.
Pinned reports retain the fresh-photo check and record their location
source and distance from the device fix when available. Pilot bounds are shared in `src/lib/geo.ts`.

The officer page loads the authorized queue in pages. Status, issue-type and area filters then
update the table and map locally, with the selection kept in the URL for links and browser
Back/Forward. Opening an issue loads its details from the server; successful mutations refresh
the server data. Supabase access and workflow decisions remain in server code.

## Deploy (Vercel)

1. Vercel → **Add New → Project** → import `Ir-Rafi/CivicTrust` (the repo owner may need to install the Vercel GitHub app for this private repo).
2. **Root Directory: `web`**. Framework, pnpm and build command are detected automatically.
3. **Environment Variables** (Production + Preview), copied from `.env.local`, marked *Sensitive*:
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`, `GEMINI_EMBEDDING_MODEL`, `GLM_API_KEY`, `GLM_API_BASE`, `GLM_TEXT_MODEL`, `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, and optionally `KPI_SINCE`.
   Not needed on Vercel: `DATABASE_URL` and the `*_BACKUP` keys. Never add a `NEXT_PUBLIC_` prefix.
   Set `CRON_SECRET` on the one deployment that should run the daily overdue check (all deployments share one
   database). `OLLAMA_BASE_URL` and `OLLAMA_API_KEY` are only for demos with the Ollama tunnel running
   ([`../automation/ollama-tunnel`](../automation/ollama-tunnel)).
4. **Settings → Functions → Region:** pick the one closest to the database (Singapore `sin1` for the current project).
5. Deploy, then open `https://<your-app>.vercel.app/api/health`: the `configured` flags for Supabase, Gemini, Groq and GLM should be `true`, and `database.ok` should be `true`. These flags confirm configuration; use the test guide to verify provider calls and workflows.

Environment variables apply only to deployments made after they are saved: redeploy after any change.

**Gemini key pool and backup models (optional).** Free Gemini keys often return `503 high demand`
or `429` quota errors. The app can spread calls over several keys and fall back to other models:

```bash
# extra keys: commas only, no spaces
GEMINI_API_KEYS=key2,key3
# backup models, tried after GEMINI_VISION_MODEL
GEMINI_VISION_FALLBACK_MODELS=gemini-3.6-flash,gemini-3-flash-preview,gemini-3.1-flash-lite
# start the next model after this many ms without an answer
GEMINI_HEDGE_MS=5000
# extra Groq keys, used when a Groq key hits its rate limit
GROQ_API_KEYS=key2
```

A key that hits its quota rests and the next key is used. The vision models start one after
another, `GEMINI_HEDGE_MS` apart, each keeping the whole remaining time; the first answer wins
and each result records the model that produced it (`ai_model`). Quota is per Google Cloud
project, so extra keys only help when they come from different projects; Google's API terms do
not allow getting around usage limits. `/api/health` shows the number of keys and the model order.

**If the build fails on Vercel but passes locally** (for example a `next/font/google` error), build on
your machine and upload the result with the Vercel CLI, logged in as a member of the project:

```bash
vercel link --yes --project <project>    # from the repo root
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

**Keep the database awake.** Supabase pauses free projects after about a week without activity.
Add an uptime monitor (for example UptimeRobot, *Keyword* type) on `/api/health` that alerts when
`"database":{"ok":true` is missing. `/api/health` answers HTTP 200 even when the database is down,
so a plain status-code check is not enough.

The database is already hosted on Supabase; schema changes are applied with
`pnpm exec supabase db push --db-url "$DATABASE_URL"`, not by Vercel.

## Checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## Layout

| Path | What |
|---|---|
| `src/lib/ai/gemini.ts` | M1 issue analysis, M3 duplicate compare, M4 repair verify, embeddings |
| `src/lib/ai/glm.ts` | Fallback Bangla + English severity explanation via GLM |
| `src/lib/ai/groq.ts` | Primary Bangla + English severity explanation (Groq) |
| `src/lib/ai/ollama.ts`, `src/lib/ai/bangla.ts` | Optional local explanation fallback (Ollama) and the Bangla-script guard for its answers |
| `src/lib/agent/`, `src/components/officer/assistant-panel.tsx` | "Ask CivicTrust" officer assistant: Mastra agent, read-only tools and answer rules |
| `src/lib/overdue.ts`, `src/lib/automation/`, `src/app/api/automation/overdue/` | Overdue rules and the daily overdue check (Vercel Cron in `vercel.json`, or n8n) |
| `src/lib/reports.ts` | Citizen report pipeline, provider time budgets, duplicate merging and location recording |
| `src/lib/severity.ts` | M2 explainable severity score + SLA deadline bands |
| `src/lib/workflow.ts`, `src/lib/repair-verdict.ts` | Assignment, repair checks and officer review, payment gate, feedback, NGO offers and audit queries |
| `src/app/*/actions.ts`, `src/app/actions/ui.ts` | Role-checked server actions and UI action results |
| `src/components/officer/officer-queue.tsx`, `src/lib/officer-queue.ts` | Local queue/map filters and shareable URL state |
| `src/lib/public-log.ts`, `src/lib/public-log-rules.ts` | Public issue progress and activity-log projection without private fields |
| `src/lib/audit.ts` | Append to the hash-chained audit log |
| `src/lib/mcp/`, `src/app/api/mcp/route.ts` | Read-only MCP tool contracts, service adapters, authenticated Streamable HTTP and protocol tests |
| `src/lib/policy.ts` | Shared policy retrieval for deadlines and MCP |
| `scripts/smoke-mcp.ts` | Official SDK client exercising the real MCP endpoint |
| `src/lib/session.ts`, `src/app/actions/session.ts` | Role switcher + language cookie (no login, by design) |
| `supabase/migrations/` | Schema, RLS, geo/RAG functions, photo bucket |
| `data/policy/` | Pilot service policy, the RAG source for deadline citations |
| `data/osm/` | Pilot-area OpenStreetMap extract (ODbL) |
| `src/lib/kpi.ts`, `src/lib/kpi-math.ts`, `src/app/impact/` | Live KPIs shared by the `/impact` page and `pnpm kpi` |
| `scripts/kpi.ts`, `scripts/eval-photos.ts` | KPI report in the terminal and labelled-photo AI evaluation |
| `scripts/smoke-agent.ts`, `scripts/eval-local-models.ts` | Officer assistant smoke test and local-model comparison |
| `../automation/` | n8n workflow for the overdue check; Ollama gateway and Cloudflare Tunnel |

## Security model (prototype)

No end-user auth. RLS is enabled on every table with no browser policies; the app talks to
the database only from server code with the secret key. Photos live in a private bucket and are
served through signed URLs. Gemini requests use `store: false`.

Role switching uses demonstration personas rather than production identity checks. Payment
release records prototype status only. A repair using the unmeasured work-site demo location
cannot be approved automatically; it requires officer review. Public data excludes exact
coordinates, citizen names and comments. See [`../TEST.md`](../TEST.md) for verification scenarios.
