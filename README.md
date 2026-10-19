<p align="center"><img src="web/public/brand/civictrust-logo.png" alt="CivicTrust logo" width="180"></p>

# CivicTrust

**Report it. AI ranks it. The city fixes it. AI checks the fix.**

Citizens photograph potholes, road cracks, garbage piles, open drains and waterlogging. AI identifies the problem and supports an explainable urgency score. A ward officer assigns a contractor or NGO with a deadline, and repair evidence is checked before the issue is marked fixed and payment becomes eligible. A public portal shows issue progress and contractor outcomes by area.

Entry for the **International AI Builders Congress 2026** — Competition 1 (Team-Built Product), **CivicSphere AI** domain, **Transparent Government** challenge (*"Open, accountable public-spending and service insight"*). The prototype demonstrates accountability through repair verification, a payment eligibility gate, tamper-evident audit records and public contractor scorecards.

| Document | What's in it |
|---|---|
| [`CivicTrust.pdf`](CivicTrust.pdf) | Product brief, preliminary compliance status, AI models, and architecture |
| [`PROTOTYPE_PLAN.md`](PROTOTYPE_PLAN.md) | Plan mapped to the judging rubric: status, video script, timeline, risks, judge Q&A |
| [`PRELIMINARY_PROTOTYPE_REQUIREMENTS.md`](PRELIMINARY_PROTOTYPE_REQUIREMENTS.md) | Requirements and acceptance criteria for the preliminary-round prototype |
| [`web/README.md`](web/README.md) | Developer setup and code layout |
| [`TEST.md`](TEST.md) | How to test and debug the prototype: scenarios per role, common problems, known issues |
| [`AIBC_Participants_Guide_261015_143157.pdf`](AIBC_Participants_Guide_261015_143157.pdf) | Participant guide for the AI Builders Congress |
| [`Docs/Idea-Overview.txt`](Docs/Idea-Overview.txt) | Original proposal (15 Oct) |

---

## Why it's different

CivicTrust **verifies the outcome**. Automatic approval requires a fresh after-photo captured after assignment, measured GPS within 15 m, and a confident AI comparison confirming the same place and a resolved problem. Partial, unclear or unavailable AI results go to an officer. Citizen disputes reopen review and withhold payment that has not already been released.

## Roles

| Role | What they do |
|---|---|
| Citizen | Report with a photo, view a live AI assessment, track the fix, confirm or dispute it |
| Ward officer | Review the ranked queue and map, correct AI results, assign work, review repairs and release eligible payment status |
| Contractor | Receive work orders, upload proof of repair |
| NGO / volunteers | Offer to help with open issues; the officer decides by assigning the work |
| Public | See issue progress, an activity log, area statistics and contractor scorecards |

The prototype has **no login**: a role switcher gives one-click access so judges can try every role.

## How the AI works

| Step | Model | What it does |
|---|---|---|
| M1 Issue detector | Gemini vision | Issue type, visual severity, hazards, privacy flags; rejects non-civic photos |
| M2 Severity score | Transparent formula | 1–10 from the photo + road class + distance to schools/hospitals + reports + days open; every factor is shown |
| M3 Duplicate filter | PostGIS + Gemini | Searches open issues within 25 m and merges confident visual matches |
| M4 Repair verifier | GPS + time + Gemini | Checks freshness, location and before/after evidence; routes uncertain repairs to officer review |
| Explanation | Groq primary, GLM fallback | One-line reason in Bangla and English, written only from computed facts |
| Policy RAG | Gemini embeddings + pgvector | Retrieves the pilot policy citation for repair deadlines |

The score is computed in code; text models explain its inputs. AI calls have timeouts. If both explanation providers fail, factual observations remain available; an unavailable repair verifier requires officer review.

## Architecture

```mermaid
flowchart TB
    subgraph Client["Browser · Bangla / English"]
        UI["Citizen · Officer · Contractor · NGO · Public"]
        Local["Camera, GPS or manual report pin<br/>Leaflet map and local officer filters"]
        UI --- Local
    end

    subgraph Server["Next.js 16 server"]
        Actions["Server actions<br/>Demo-role checks and input validation"]
        Workflow["Report and duplicate processing · severity formula<br/>Assignment and policy deadlines · repair review<br/>Payment gate · citizen feedback · public views"]
        Actions --> Workflow
    end

    subgraph AI["AI providers"]
        Gemini["Gemini<br/>Issue, duplicate and repair vision<br/>Policy embeddings"]
        Text["Groq primary → GLM fallback<br/>Bangla and English explanations"]
    end

    subgraph Data["Supabase · server-only access"]
        DB[("Postgres + PostGIS + pgvector<br/>Issues, work orders, offers, policy chunks<br/>Hash-chained audit records")]
        Photos["Private photo storage<br/>Temporary signed URLs"]
    end

    OSM["OpenStreetMap<br/>Roads, schools, hospitals and area names"]
    Policy["Team-authored pilot service policy"]

    UI <-->|"Server requests and results"| Actions
    Workflow <--> Gemini
    Workflow <--> Text
    Workflow <--> DB
    Workflow <--> Photos
    OSM -->|"Reference-data seeding"| DB
    OSM -->|"Cached area lookup"| Workflow
    Policy -->|"Embedding and seed script"| DB
```

The server owns workflow decisions and database writes. The officer page loads the authorized pilot queue in pages, then filters the table and map in the browser; each filter selection avoids a new database request. Opening issue details uses server data, and successful workflow actions refresh the queue.

Road and facility data come from OpenStreetMap. Public figures use official wards when boundaries are loaded, otherwise recorded OpenStreetMap areas; these areas are not official ward boundaries. Policy retrieval uses Gemini embeddings and pgvector, with severity-based deadline rules available if retrieval fails.

## Safeguards

- Row-level security on application tables; the database secret key stays in server code
- Tamper-evident audit log: hash-chained and append-only, records workflow events and AI corrections
- Officers can correct issue assessments and review repairs, with reasons recorded
- Extra-report bonus capped to limit the influence of report volume on urgency
- Browser photo processing removes original EXIF metadata; public results exclude exact coordinates and citizen names
- Private photo storage with temporary signed URLs; Gemini image requests specify `store: false`

## Prototype status

| Area | Implemented |
|---|---|
| Citizen reporting | Photo submission, GPS or manual pin, live AI assessment, duplicate merging, severity breakdown and repair feedback |
| Officer workflow | Queue and map, local status/type/area filters, issue history, AI corrections, assignment, repair review and payment status |
| Contractor and NGO | Assigned work, repair evidence, verification results and NGO offers to help |
| Public transparency | Issue progress, activity log, area statistics, contractor scorecards and audit-chain verification |
| Supporting pages and tools | Architecture, data and security pages; migrations, reference-data seeding, KPI and labelled-photo evaluation scripts |

This is a preliminary prototype. Role switching uses demonstration personas, payment release changes a recorded status, and no bank transfer is made. Official ward boundaries, production authentication and city-wide deployment are outside the current demonstration setup.

Use [`TEST.md`](TEST.md) for acceptance scenarios and the measurement scripts in [`web/README.md`](web/README.md) to produce evidence. Classification accuracy, repair accuracy and other performance claims require measured results from representative test data. Scope and remaining submission work are tracked in [`PROTOTYPE_PLAN.md`](PROTOTYPE_PLAN.md).

## Run it locally

Requires Node 22+ and pnpm.

```bash
cd web
pnpm install
cp .env.example .env.local    # add Supabase, Gemini, Groq and GLM keys (ask the team lead)
pnpm dev                      # http://localhost:3000
```

Database setup, data seeding and all scripts: [`web/README.md`](web/README.md).

## Working on this repo

- Branch from `main`, open a pull request; CI runs tests, typecheck, lint and build.
- **Never commit `web/.env.local`** or paste keys into code, issues or chat. It is git-ignored; don't force-add anything under `web/`.
- Every AI result shown in a demo must be computed live. Fabricated results disqualify the team.

## Team

| Role (required by the Congress) | Member |
|---|---|
| Team Leader / Coordinator | |
| Business Analyst / Data Scientist | |
| UI/UX / Frontend Developer | |
| Backend / Data Engineer | |
| Presentation / Communication Lead | |

## Data and licences

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL 1.0
- Pilot service policy in `web/data/policy/` is written by the team; it is not an official city regulation
- Code: [MIT](LICENSE)
