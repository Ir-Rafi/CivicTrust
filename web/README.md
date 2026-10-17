# CivicTrust — prototype

Citizens photograph potholes and garbage; AI classifies and scores urgency; officers assign
contractors; AI verifies the repair photo before a job can close. Plan and judging alignment:
[`../PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md).

## Stack

Next.js 16 · Supabase (Postgres + PostGIS + pgvector, Storage) · Gemini (vision, embeddings) ·
Groq (bilingual text) · Leaflet + OpenStreetMap.

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
```

### Run

```bash
pnpm dev            # http://localhost:3000
curl localhost:3000/api/health   # shows which integrations are configured
```

## Checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## Layout

| Path | What |
|---|---|
| `src/lib/ai/gemini.ts` | M1 issue analysis, M3 duplicate compare, M4 repair verify, embeddings |
| `src/lib/ai/groq.ts` | Bangla + English severity explanation |
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
