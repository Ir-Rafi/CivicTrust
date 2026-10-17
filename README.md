# CivicTrust

**Report it. AI ranks it. The city fixes it. AI checks the fix.**

Citizens photograph potholes ,  garbage piles, open drains and waterlogging. AI identifies the problem and scores its urgency, the ward officer assigns it to a contractor or an NGO with an automatic deadline, and AI compares the repair photo with the original before the job is allowed to close. A public portal shows open vs. fixed issues per ward.

Entry for the **International AI Builders Congress 2026** — Competition 1 (Team-Built Product), **CivicSphere AI** domain, *Transparent Government* challenge area.

| Document | What's in it |
|---|---|
| [`CivicTrust.pdf`](CivicTrust.pdf) | Product spec v2: users, features by priority, AI models, architecture |
| [`PROTOTYPE_PLAN.md`](PROTOTYPE_PLAN.md) | Plan mapped to the judging rubric: status, video script, timeline, risks, judge Q&A |
| [`web/README.md`](web/README.md) | Developer setup and code layout |
| [`Docs/Idea-Overview.txt`](Docs/Idea-Overview.txt) | Original proposal (15 Oct) |

---

## Why it's different

Most civic apps stop at "report a problem". CivicTrust **verifies the outcome**: a job closes only when the after-photo is taken on the spot (±15 m), is fresh, and the AI confirms the problem is gone. Unsure cases go to an officer, never auto-closed.

## Roles

| Role | What they do |
|---|---|
| Citizen | Report with a photo, get an instant AI assessment, track the fix, confirm or dispute it |
| Ward officer | Work the AI-ranked queue and map, correct the AI, assign contractors with deadlines |
| Contractor | Receive work orders, upload proof of repair |
| NGO / volunteers | Claim open issues to fix for free |
| Public | See open vs. fixed issues and fix times per ward |

The prototype has **no login**: a role switcher gives one-click access so judges can try every role.

## How the AI works

| Step | Model | What it does |
|---|---|---|
| M1 Issue detector | Gemini vision | Issue type, visual severity, hazards, privacy flags; rejects non-civic photos |
| M2 Severity score | Transparent formula | 1–10 from the photo + road class + distance to schools/hospitals + reports + days open; every factor is shown |
| M3 Duplicate filter | PostGIS + Gemini | Reports within 25 m showing the same problem are merged |
| M4 Repair verifier | GPS + time + Gemini | Same spot, fresh photo, before/after comparison |
| Explanation | Groq | One-line reason in Bangla and English, written only from computed facts |
| Policy RAG | Gemini embeddings + pgvector | Cites the rule behind each repair deadline |

Example from a real test photo: *"Pothole on a residential road, 61 m from a school"* · *"আবাসিক রাস্তায় গর্ত, স্কুল থেকে ৬১ মিটার দূরে"* · severity 6.

For the finals, M1/M3/M4 move to self-hosted YOLO + CLIP models so citizen photos stay on infrastructure the city controls.

## Architecture

```
Web app (Next.js 16, mobile-first, Bangla + English)
        │ server actions
Next.js server ── reports · severity · duplicates · work orders · deadlines · audit log
        │                         │
   Gemini + Groq APIs       Supabase: Postgres + PostGIS + pgvector, private photo storage
                                  ▲
                    OpenStreetMap roads, schools, hospitals (seed scripts)
```

## Safeguards

- Database closed to the browser: row-level security on every table, server-only access
- Tamper-evident audit log: hash-chained and append-only, records every action and AI correction
- Officers can override any AI decision, with a reason
- Extra-report bonus capped, so busy or well-connected areas can't outrank quieter ones
- Photo location metadata removed after reading; public sees area-level locations only
- Photos sent to Gemini with `store: false`

## Status (17 Oct 2026)

| Done | Next |
|---|---|
| Schema, security and geo functions on hosted Supabase · AI pipeline verified on a real photo · severity score with tests · Bangla/English shell with role switcher · OSM data for the Dhanmondi pilot area | Citizen report flow (camera, GPS, live AI) → officer queue and map → contractor repair verification → public portal |

Full timeline and risks: [`PROTOTYPE_PLAN.md`](PROTOTYPE_PLAN.md). Preliminary submission: **31 Oct 2026**.

## Run it locally

Requires Node 22+ and pnpm.

```bash
cd web
pnpm install
cp .env.example .env.local    # add Supabase, Gemini and Groq keys (ask the team lead)
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
