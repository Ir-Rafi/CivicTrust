# Preliminary round checklist

**Deadline: 20 November 2026, 5:59 PM UTC (11:59 PM Bangladesh time)** on Cloudcamp ("Idea to Unicorn —
Preliminary Submission"; first set for 31 October).
Work from top to bottom: later steps depend on earlier ones. Tick items only after checking them.
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
- [x] New AI keys in `web/.env.local`: Gemini key pool (10 keys) with four backup models, Groq key pool (2 keys), new GLM key (Backend)
- [x] New AI keys on both Vercel projects, then redeploy (Backend, Irfan): both report 10 Gemini and 2 Groq keys
- [x] `CRON_SECRET` on eight only, for the daily overdue check (first automatic run 20 Nov, 09:03)
- [ ] Remove `CRON_SECRET` from siuu, so only one deployment runs the daily check (Rafi)
- [ ] Reset the database password and Supabase secret key, which were shared in chat; update `.env.local` and Vercel (Team lead)
- [ ] After both sites run on the new keys, delete the old keys at the providers: Gemini ×2 and Groq ×2 still work, plus the old GLM and AgentRouter keys (Team lead)
- [ ] Optional: a Zhipu balance, or another text model, so the GLM backup works (`glm-4.7-flash` is the only free GLM model and is often overloaded)
- [ ] Share the new settings privately with teammates who run the app locally (Team lead)
- [ ] Uptime monitor on `/api/health` (keyword `"database":{"ok":true`) so the free database never pauses during judging (Backend)
- [ ] Push all work to `main`, then redeploy both sites (Backend, Irfan): eight is on the latest commit; siuu is one commit behind
- [ ] Remove the duplicate Vercel project (`civictrust` or `civic-trust`) (Irfan)

## 3. Measurement and impact

Procedure: [`KPI_SUMMARY.md`](KPI_SUMMARY.md).

- [x] Expected outcomes and KPIs defined; unmeasured results labelled
- [x] KPI counting reviewed: AI events counted for every run; duplicate comparisons recorded on merges
- [ ] Measurement run on the live site with the key pool and `KPI_SINCE` set (Team)
- [ ] Copy the `/impact` figures, with sample sizes and date window, into `KPI_SUMMARY.md` (Backend)
- [ ] Optional: labelled-photo evaluation with labels set by people (Team)

## 4. Documents

- [ ] Name a member for every role in the README team table (Team lead)
- [x] One-page problem summary: problem, users, need, sourced facts (`Docs/CivicTrust_One_Page_Summary-1.pdf`)
- [ ] Bangla text reviewed by a native speaker: AI reasons and screen text (Team)
- [x] `CivicTrust.pdf` matches what is built (Backend; updated 20 Nov)
- [ ] Cloudcamp submission form completed, under the International AI Builders Congress event (Team lead)

## 5. Video (at most 180 seconds, the five official segments in order)

Outline: [`PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md) §5.

- [ ] 0:00–0:30 Problem: users and need, with sourced facts (M2)
- [ ] 0:30–1:00 Solution: one-line pitch, the five roles, "AI closes the job only if it is really fixed"
- [ ] 1:00–2:00 Demo in Bangla: report, AI result, officer assignment, repair safeguard, public outcome (M5, M6)
- [ ] 2:00–2:30 AI approach: architecture diagram on screen for at least 10 seconds, models, safeguards (M3, M4)
- [ ] 2:30–3:00 Impact: expected outcomes and the `/impact` figures, then pilot and expansion (M7)
- [ ] Every AI result shown comes from a live request; sample photos and demo locations are identified
- [ ] Recorded backup of the demo in case the connection fails

## 6. Submission package (Section 9.1)

- [ ] Problem definition: one-page summary
- [ ] AI architecture: diagram, `/architecture`, model card
- [ ] Data and sovereignty: `/data`, data flows, external services
- [ ] Demo: public URL (no login) and the video
- [ ] Scalability roadmap: pilot, city, national, global
- [ ] Ethical safeguards: `/security`, `/audit`, model card, privacy and bias

## 7. Final self-check

- [ ] All seven mandatory items (M1–M7) visible in the video
- [ ] Video at most 180 seconds, five segments in order
- [ ] Bangla shown on screen
- [ ] Expected outcomes, targets and measured results clearly separated
- [ ] All six submission components complete
- [ ] Every team role assigned to a named member
- [ ] AI tool usage documented (README, "AI tools used")
- [ ] Data licences and sources listed (OpenStreetMap ODbL)
- [ ] Public URL opens on a phone for someone outside the team
- [ ] **Submitted** (date: ____ )
