# Preliminary round checklist

**Deadline: 31 Oct 2026. Target: submit on 30 Oct** (31 Oct is buffer).
Tick items as they are done. Work top to bottom: later steps depend on earlier ones.
Sources: [`PRELIMINARY_PROTOTYPE_REQUIREMENTS.md`](../PRELIMINARY_PROTOTYPE_REQUIREMENTS.md),
[`PROTOTYPE_PLAN.md`](../PROTOTYPE_PLAN.md) §1a, §6 and §11.

## 1. Product (done and verified on 19 Oct)

- [x] Citizen report: camera, GPS map, manual pin, place names, demo spots (FR-01)
- [x] Live AI analysis, explainable severity, Bangla/English reason (FR-02, FR-03, FR-05)
- [x] Duplicate merge within 25 m (FR-04)
- [x] Officer queue, map, filters (status, type, area), corrections with history (FR-06)
- [x] Work order with cost, deadline and policy citation (FR-07)
- [x] Repair verification: location, freshness, AI; unsure → officer (FR-08)
- [x] Payment withheld until verified; dispute blocks payment (FR-09)
- [x] Public tracker, update log, per-area figures, contractor scorecards (FR-10)
- [x] Tamper-evident audit log that can't be edited or emptied (FR-11)
- [x] NGO "We can help" offers
- [x] Screens: architecture, data, security, model card, audit (§6)
- [x] Measurement scripts: `pnpm kpi`, `pnpm eval:photos` (§8)

## 2. Deploy and keys

- [ ] Push all local work to `main` (Backend)
- [ ] Redeploy on Vercel after each push; Hobby only deploys the owner's commits (Irfan)
- [ ] Live site shows `/model-card` and the latest changes (Irfan)
- [ ] Add `GLM_API_KEY` on Vercel; `/api/health` shows `"glm": true` (Irfan)
- [ ] Paid Gemini key in `.env.local` and on Vercel (Team lead)
- [ ] Rotate the 6 keys that were committed earlier: Gemini ×2, Groq ×2, GLM, AgentRouter (Team lead)
- [ ] Remove the duplicate Vercel project (`civictrust` or `civic-trust`) (Irfan)

## 3. Field shoot and measurements (needs the paid key)

Protocol: [`KPI_SUMMARY.md`](KPI_SUMMARY.md).

- [ ] 30+ issue photos in Dhanmondi, labelled by folder, incl. ~5 non-civic (Team)
- [ ] 5+ fixed and 5+ not-fixed before/after pairs (Team)
- [ ] 10–15 live reports from a phone, some twice from nearby to test duplicates (Team)
- [ ] One real repair approved by the AI end to end, for the video (AC8) (Team)
- [ ] Run `pnpm eval:photos` and `pnpm kpi --since <shoot date>`; keep the JSON output (Backend)
- [ ] Fill the "Measured" table in `KPI_SUMMARY.md` with sample sizes (Backend)
- [ ] Agree the targets (proposed: ≥85% accuracy, ≤20 s median); keep them labelled as targets (Team)

## 4. Documents

- [ ] Name a member for every role in the README team table (Team leader, BA, Presentation lead) (Team lead)
- [ ] 1-page problem summary: problem, users, need, sourced facts (BA)
- [ ] Bangla text reviewed by a native speaker: AI reasons, screen text (Team)
- [ ] `CivicTrust.pdf` and README match what is built (Backend)
- [ ] Remove test data before recording: only real reports in the database (Backend)

## 5. Video (≤ 180 s, the five official segments in order)

Outline: `PROTOTYPE_PLAN.md` §5.

- [ ] 0:00–0:30 Problem: real Dhaka footage, who suffers, sourced numbers (M2)
- [ ] 0:30–1:00 Solution: one-line pitch, the five roles, "AI closes the job only if it's really fixed"
- [ ] 1:00–2:00 Demo, live and in Bangla: report → AI result → duplicate → officer assigns → bad repair rejected, payment withheld → good repair approved → citizen confirms → public portal (M5, M6)
- [ ] 2:00–2:30 AI approach: architecture diagram on screen ≥ 10 s, models, safeguards (M3, M4)
- [ ] 2:30–3:00 Impact: measured KPIs (targets labelled), pilot → city → national (M7)
- [ ] Every AI result in the video computed live on real input; no mock-ups
- [ ] Recorded backup of the demo in case Wi-Fi fails

## 6. Submission package (Sec. 9.1)

- [ ] Problem definition: 1-page summary
- [ ] AI architecture: diagram, `/architecture`, model card
- [ ] Data and sovereignty: `/data`, data flows, external services list
- [ ] Demo: public URL (works without login) and the video
- [ ] Scalability roadmap: pilot → city → national → global
- [ ] Ethical safeguards: `/security`, `/audit`, model card, privacy and bias

## 7. Final self-check (before submitting)

- [ ] All 7 mandatory items (M1–M7) visible in the video
- [ ] Video ≤ 180 s, five segments in order
- [ ] Bangla shown on screen
- [ ] KPIs shown are measured; targets labelled as targets
- [ ] All 6 submission components complete
- [ ] Every team role assigned to a named member
- [ ] AI tool usage documented (README "AI tools used")
- [ ] Data licences and sources listed (OpenStreetMap ODbL)
- [ ] Public URL opens for someone outside the team, on a phone
- [ ] **Submitted** (date: ____ )
