# Preliminary round checklist

**Deadline: 20 November 2026, 5:59 PM UTC (11:59 PM Bangladesh time)** on Cloudcamp ("Idea to Unicorn —
Preliminary Submission"; first set for 31 October).
Sources: [`PRELIMINARY_PROTOTYPE_REQUIREMENTS.md`](../PRELIMINARY_PROTOTYPE_REQUIREMENTS.md) and
[`PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md) (§1a, §6 and §11).

## 1. Product

- [x] Citizen report: camera or photo file, GPS map, manual pin, place names, demo spots (FR-01)
- [x] Live AI analysis, explainable severity and Bangla/English reason (FR-02, FR-03, FR-05)
- [x] Duplicate merge within 25 m (FR-04)
- [x] Officer queue, map, filters (status, type, area), AI corrections with history (FR-06)
- [x] Work order with cost, deadline and policy citation (FR-07)
- [x] Repair verification: location, freshness, AI; unsure results go to an officer (FR-08)
- [x] Payment withheld until verified; a dispute blocks payment (FR-09)
- [x] Public tracker, update log, per-area figures, contractor scorecards (FR-10)
- [x] Tamper-evident audit log that cannot be edited or emptied (FR-11)
- [x] NGO "We can help" offers
- [x] Information pages: architecture, data, security, model card, audit
- [x] Live impact page (`/impact`) with KPIs computed from the database; `pnpm kpi` and `pnpm eval:photos`

## 2. Hosting, deployment and keys

- [x] Database moved to the Singapore Supabase project; data, photos and audit chain verified
- [x] Previous database project paused
- [x] civic-trust-siuu.vercel.app on the Singapore database with GLM enabled (Irfan)
- [x] civictrust-eight.vercel.app deployed from the team's own Vercel account; it is now the main demo, with civic-trust-siuu as backup (Backend)
- [x] New AI keys in `web/.env.local`: Gemini key pool (10 keys) with four backup models, Groq key pool (5 keys), new GLM key (Backend)
- [x] New AI keys on both Vercel projects, then redeploy (Backend, Irfan): both report 10 Gemini and 5 Groq keys (checked 20 Nov)
- [x] `CRON_SECRET` on eight only, for the daily overdue check (first automatic run 20 Nov, 09:03)
- [x] Remove `CRON_SECRET` from siuu, so only one deployment runs the daily check (Rafi; siuu's overdue endpoint returns 503, checked 20 Nov)
- [x] `MCP_AUTH_TOKEN` on both sites: all six MCP tools pass with the token and requests without it get 401 (checked 20 Nov)
- [ ] Optional: a Zhipu balance or another text model, as a paid backup alongside the free `glm-4.7-flash`
- [x] Uptime monitor on the deployed site (UptimeRobot), so the free database never pauses during judging (Backend)
- [x] Push all work to `main`, then redeploy both sites (Backend, Irfan): both run the latest app code; later commits change documents only (checked 20 Nov)

## 3. Measurement and impact

Procedure: [`KPI_SUMMARY.md`](KPI_SUMMARY.md).

- [x] Expected outcomes and KPIs defined; unmeasured results labelled
- [x] KPI counting reviewed: AI events counted for every run; duplicate comparisons recorded on merges
- [x] Measurement run on the live site with the key pool (20 Nov, main site, desktop with demo locations; results in `KPI_SUMMARY.md`)
- [x] Copy the `/impact` figures, with sample sizes and date window, into `KPI_SUMMARY.md` (all records to 20 Nov)
- [ ] Optional: labelled-photo evaluation with labels set by people (Team)

## 4. Documents

- [x] Name a member for every role in the README team table (Team lead)
- [x] One-page problem summary: problem, users, need, sourced facts (`Docs/CivicTrust_One_Page_Summary-1.pdf`)
- [x] Bangla text reviewed by a native speaker: AI reasons and screen text (Team)
- [x] `CivicTrust.pdf` matches what is built (Backend; updated 20 Nov)
- [x] Cloudcamp submission form completed, under the International AI Builders Congress event (Team lead)

## 5. Video (at most 180 seconds, the five official segments in order)

Outline: [`PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md) §5.

- [x] 0:00–0:30 Problem: users and need, with sourced facts (M2)
- [x] 0:30–1:00 Solution: one-line pitch, the five roles, "AI closes the job only if it is really fixed"
- [x] 1:00–2:00 Demo in Bangla: report, AI result, officer assignment, repair safeguard, public outcome (M5, M6)
- [x] 2:00–2:30 AI approach: architecture diagram on screen for at least 10 seconds, models, safeguards (M3, M4)
- [x] 2:30–3:00 Impact: expected outcomes and the `/impact` figures, then pilot and expansion (M7)
- [x] Every AI result shown comes from a live request; sample photos and demo locations are identified
- [x] Recorded backup of the demo in case the connection fails

## 6. Submission package (Section 9.1)

- [x] Problem definition: one-page summary (`Docs/CivicTrust_One_Page_Summary-1.pdf`)
- [x] AI architecture: diagram, `/architecture`, model card
- [x] Data and sovereignty: `/data`, data flows, external services
- [x] Demo: public URL with no login (civictrust-eight.vercel.app; backup civic-trust-siuu.vercel.app)
- [x] Demo: the video, attached in the Cloudcamp form (Team lead)
- [x] Scalability roadmap: pilot, city, national, global (`/docs` roadmap and business sections, one-page summary)
- [x] Ethical safeguards: `/security`, `/audit`, model card, privacy and bias

## 7. Final self-check

- [x] All seven mandatory items (M1–M7) visible in the video
- [x] Video at most 180 seconds, five segments in order
- [x] Bangla shown on screen
- [x] Expected outcomes, targets and measured results clearly separated (`/impact` status labels, `KPI_SUMMARY.md`)
- [x] All six submission components complete
- [x] Every team role assigned to a named member
- [x] AI tool usage documented (README, "AI tools used")
- [x] Data licences and sources listed (OpenStreetMap ODbL; README and `/data`)
- [x] Public URL opens on a phone for someone outside the team
- [x] **Submitted** (date: 20 November 2026)
