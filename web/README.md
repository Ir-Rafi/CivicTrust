# CivicTrust — prototype

Citizens photograph potholes and garbage; AI classifies and scores urgency; officers assign
contractors; AI verifies the repair photo before a job can close. Plan and judging alignment:
[`../PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md).

Backend service contracts for the officer, contractor, citizen, public, and audit flows are documented in [`BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md).

## Stack

Next.js 16 · Supabase (Postgres + PostGIS + pgvector, Storage) · Gemini (vision, embeddings) ·
Groq (primary bilingual text) + GLM (fallback) · Leaflet + OpenStreetMap.

## Setup

Requires Node 22+ (`nvm use` reads `../.nvmrc`) and pnpm.

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

### Measurements (requirements §8)

```bash
pnpm kpi [--since 2026-10-24] [--json kpi.json]   # from the live database and audit log
pnpm eval:photos <folder> [--json eval.json]       # accuracy on a labelled photo set; see the script header for the folder layout
```

### Run

```bash
pnpm dev            # http://localhost:3000
curl localhost:3000/api/health   # shows which integrations are configured
```

Citizen reports use GPS by default. **Choose the spot on the map yourself** enables manual
selection by tapping or dragging a pin inside the Dhanmondi pilot boundary. Users can return
to GPS at any time. Pinned reports retain the fresh-photo check and record their location
source and distance from the device fix when available. Pilot bounds are shared in `src/lib/geo.ts`.

## Deploy (Vercel)

1. Vercel → **Add New → Project** → import `Ir-Rafi/CivicTrust` (the repo owner may need to install the Vercel GitHub app for this private repo).
2. **Root Directory: `web`**. Framework, pnpm and build command are detected automatically.
3. **Environment Variables** (Production + Preview), copied from `.env.local`, marked *Sensitive*:
   `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_VISION_MODEL`, `GEMINI_EMBEDDING_MODEL`, `GLM_API_KEY`, `GLM_API_BASE`, `GLM_TEXT_MODEL`, `GROQ_API_KEY`, `GROQ_TEXT_MODEL`.
   Not needed on Vercel: `DATABASE_URL` and the `*_BACKUP` keys. Never add a `NEXT_PUBLIC_` prefix.
4. **Settings → Functions → Region:** pick the one closest to the database (Sydney `syd1` for the current project).
5. Deploy, then open `https://<your-app>.vercel.app/api/health`: all three integrations should be `true` and `database.ok` should be `true`.

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
| `src/lib/severity.ts` | M2 explainable severity score + SLA deadline bands |
| `src/lib/audit.ts` | Append to the hash-chained audit log |
| `src/lib/session.ts`, `src/app/actions/session.ts` | Role switcher + language cookie (no login, by design) |
| `supabase/migrations/` | Schema, RLS, geo/RAG functions, photo bucket |
| `data/policy/` | Pilot service policy, the RAG source for deadline citations |
| `data/osm/` | Pilot-area OpenStreetMap extract (ODbL) |

## Security model (prototype)

No end-user auth. RLS is enabled on every table with no browser policies; the app talks to
the database only from server code with the secret key. Photos live in a private bucket and are
served through signed URLs. Gemini requests use `store: false`.
