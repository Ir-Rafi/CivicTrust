# CivicTrust — Judge-Aligned Plan

Built from the official rules in `AIBC_Participants_Guide_261015_143157.pdf` (Sections 9, 11, 13, 14, 15, 20) and the product spec in `CivicTrust.pdf`.
Updated: 17 Oct 2026. **Preliminary closes 31 Oct 2026 (14 days).**

Every feature, page and minute of video below exists because it earns points somewhere in the rules. If it doesn't score, it's cut or moved later.

---

## Status at a glance (17 Oct)

| Area | State |
|---|---|
| Decisions | Next.js + Supabase · Gemini (vision, embeddings) + Groq (text) · **no login** (role switcher) · pilot area Dhanmondi, Dhaka |
| Days 1–2 build | Done: app scaffold, schema + migration, AI helpers, severity score + tests, role switcher, Bangla/English, OSM data (226 schools/hospitals/clinics, 810 roads), pilot policy for RAG. Build, lint, typecheck and tests pass. |
| Database | Hosted Supabase (Sydney region) live: schema applied, security advisor clean, RLS verified, audit chain + geo functions tested; 219 schools/hospitals/clinics + 810 roads loaded; app connected |
| AI | Verified end to end on a real photo: Gemini analysis (~7 s), severity, Groq Bangla/English reason (~1.4 s), policy RAG returns the right rule. Primary + backup keys for both. |
| Docs | `CivicTrust.pdf` updated with preliminary compliance status and current implementation scope |
| Blockers | **Ward boundaries** (see §8 risks) |
| Citizen flow | Built and tested end to end with real AI: photo → Gemini → duplicate merge → severity → Bangla/English reason → saved + audit-logged; non-civic photos rejected and not stored. Too slow (~20 s); speed-up next. |
| Next | Speed up the report pipeline; then days 6–7: officer queue, map, assign with cost + cited deadline |

---

## 0. Our entry

| | |
|---|---|
| Competition | **Competition 1 — Team-Built Product** (3–5 members) |
| Domain | **CivicSphere AI** — Government, Public Services & Digital Nations |
| Challenge area | **Transparent Government** — *"Open, accountable public-spending and service insight"* |
| Official specific ask | *"Accountability and trust gains"* → AI-verified repair closure, payment released only for verified repairs, tamper-evident audit log, citizen confirm/dispute |
| Official details | *"Knowledge graphs + public dashboards"* → accountability graph (issue ↔ ward ↔ road ↔ contractor ↔ payment) with contractor scorecards; public transparency portal |
| Why not Smart Nation | Smart Nation asks for *planning* intelligence ("evidence-based policy outcomes"), and its own example prompt is a vision road-safety audit, so a road-defect detector would look like the obvious entry there. Under Transparent Government, AI-verified public works is a distinctive answer to the accountability ask. Planning insights (recurring hotspots, where to rebuild vs. patch) stay as a secondary benefit in the pitch. |
| One-line pitch | *Citizens photograph a pothole or garbage pile; AI measures and ranks it; the city assigns it; and **AI checks the repair photo — the job closes only if the road is actually fixed.*** |
| Domain warning | CivicSphere must apply **extra rigor to privacy, accuracy and public safety** (Sec. 15, 20.5) |

---

## 1. How we are scored (the rules in one place)

### 1a. Stage 1 — Preliminary video (decides who reaches the finals)
**Every** item below is mandatory (Sec. 9.2):

| # | Mandatory requirement | Our evidence | Done when |
|---|---|---|---|
| M1 | 3-minute structured video | Script in §5 | Video ≤ 180 s, follows 5 segments |
| M2 | Clear problem & user definition | Problem statement + 5 user roles | Sourced facts, named users |
| M3 | AI-native approach (LLM / RAG / Graph / ML) | Vision model (Gemini) + severity model + LLM explanations (Groq) + RAG over city rules + accountability graph (contractor scorecards) | All shown in video |
| M4 | Basic system flow input → AI → output | Architecture diagram + live flow | Diagram on screen ≥ 10 s |
| M5 | Initial demo / prototype / workflow | Deployed app, public URL | Core loop works live |
| M6 | Bangla / localization | Bangla UI (default) + Bangla AI explanations | Demo shown in Bangla |
| M7 | Defined impact (KPIs) | KPI table §4 | KPIs on screen with measured values |

Evaluator criteria per video segment: Problem → *clarity, relevance* · Solution → *simplicity, uniqueness* · Demo → *feasibility, logic* · AI → *depth, structure* · Impact → *vision, potential*.

Common mistakes the guide lists for this stage (and our guard):
idea only, no system thinking → **working app** · no clear AI explanation → **AI segment with diagram** · overcomplicating → **one core loop** · no demo/workflow visual → **live demo** · ignoring real users → **real Dhaka photos, real map data**.

> *"You are not judged on completion. You are judged on your ability to execute."*

### 1b. Stage 2 — Congress Day (26 Dec)
- **5 min per team:** 1 min transition + **3 min pitch** + 1 min scoring.
- Flow required: **problem → solution → demo → AI → impact**, followed by judge questions.
- Scored once, independently, against the **100-point rubric**:

| Component (20 pts each) | What judges evaluate (official wording) |
|---|---|
| **A. Innovation & AI-Native Design** | Originality, creativity, non-obvious, transformative application of AI |
| **B. Technical Excellence & Architecture** | Architecture quality, AI integration depth, robustness, explainability of the intelligence core |
| **C. Business Value & Commercial Viability** | Measurable economic value, clear value proposition, realistic path to a sustainable, monetizable business |
| **D. Global Scalability & Real-World Impact** | Capacity to scale to millions and international markets; jobs, productivity, exports or societal benefit |
| **E. Responsible AI, Data Sovereignty & Presentation** | Fairness, explainability, bias mitigation, privacy, governance, data ownership — communicated with clarity and confidence |

**Score bands (per component):** 0–5 weak · 6–10 functional, limited depth · 11–15 strong · **16–20 breakthrough: "globally competitive, production-grade, with documented safeguards."**
→ To reach 16–20 we need **working + documented + safeguarded**, not just working.

Bonuses / advantages: **≥1 woman on the team (bonus points)** · NRB/expert member recognised in B and D · polytechnic/madrasah cross-institution teams encouraged.

### 1c. Disqualification risks (Sec. 20)
Fabricated demos or **fake/simulated results** · misrepresenting technical capability · unlawful data · un-anonymised personal data · undocumented AI usage · undocumented NRB help.
→ **Rule for us:** every AI result shown is computed live on real input. Never show a hard-coded result as if AI made it. Say clearly what is roadmap.

---

## 2. Features mapped to points

Priority means **when it must score**: **P0 = preliminary (31 Oct)** · **P1 = finals (by 25 Dec)** · **P2 = roadmap slide only**.
Rubric columns: A Innovation · B Technical · C Business · D Scale/Impact · E Responsible AI.

### Core loop (P0 — this is the demo)
| Feature | A | B | C | D | E | Notes |
|---|---|---|---|---|---|---|
| Citizen snaps photo in-app (GPS + time auto-captured, camera-only, no gallery upload) | | ● | | | ● | Camera-only blocks old/fake photos |
| **Vision AI analysis** (Gemini): issue type, visual severity, confidence; one-line reason in Bangla + English (Groq) | ● | ● | | ● | | M3, M6 |
| **Explainable severity 1–10** — every component shown (visual + road class + school/hospital nearby + reports + days open) | ● | ● | | | ● | "Explainability of intelligence core" |
| Duplicate detection (PostGIS 25 m + AI same-scene check) → "already reported — your report is counted" | | ● | ● | | | Saves officer time = economic value |
| Officer AI-ranked queue + live map, filters by area/type/status | | ● | ● | | | |
| **Human override** of AI type/severity, with reason, logged | | | | | ● | Human-in-the-loop |
| Assign contractor → deadline auto-set from severity, **with RAG citation of the rule used** | | ● | | | ● | Puts RAG in the core loop |
| Contractor inbox → after-photo at same spot | | ● | | | | |
| **AI repair verifier** (GPS ±15 m + before/after vision comparison + fresh capture time) → approve / reject / send to officer | ● | ● | ● | | ● | **Headline innovation** |
| Citizen confirms or disputes fix | | | | | ● | Closes trust loop |
| Public transparency portal: open vs fixed per ward, avg fix time, before/after gallery, money released vs withheld | ● | | | ● | ● | The challenge's "public dashboards"; needs ward boundaries (§8) |
| **Payment tied to verification**: each work order records the agreed cost; payment counts as released only after AI-verified repair, withheld on rejection | ● | | ● | | ● | The challenge's "accountable public-spending"; demo shows "payment withheld" when AI rejects a fake repair |
| **Contractor scorecards** from the accountability graph: repairs approved vs rejected by AI, on-time rate, disputes | ● | ● | ● | | ● | The challenge's "knowledge graphs" (minimal version for the preliminary) |
| Bangla + English throughout (Bangla default) | | | | ● | | M6 |
| Role switcher (Citizen / Officer / Contractor / NGO / Public) — **no login, by design** | | | | | | One-click access for judges |

### Safeguards (P0 — cheap, needed for the 16–20 band)
| Feature | E | Notes |
|---|---|---|
| Database closed to the browser: row-level security on every table, server-only access | ● | Replaces login for the prototype (built) |
| Strip EXIF from stored photos after reading GPS/time | ● | Privacy |
| Public sees area-level location; exact pins only in officer/contractor views | ● | Privacy |
| **Tamper-evident audit log** (hash-chained: every status change, AI decision, override) | ● | Governance (schema built) |
| Report bonus is **capped** in the severity score | ● | Bias mitigation (built + tested) |
| Gemini calls sent with `store: false` | ● | Photos not retained by the API for retrieval (built) |
| Model card page: what the AI does, known limits, accuracy measured | ● | "Documented safeguards" |
| Face + number-plate blurring | ● | **Stretch P0**; if it slips, state it honestly as P1 |

### Finals upgrades (P1 — Nov/Dec, raises B, D, E toward 16–20)
| Feature | Scores | Why |
|---|---|---|
| Self-hosted YOLO detector + CLIP similarity (ONNX) replacing Gemini for M1/M3/M4 | B, E | Model-selection logic + **data sovereignty** (photos stay on city-controlled infra) |
| **Agent pipeline** made explicit: Triage → Dedupe → Routing → Verifier agents with an orchestrator, traced per issue | A, B | "Agentic", "multi-agent" are named preferred capabilities |
| "Ask CivicTrust" officer copilot (RAG over rules + live issue data, Bangla/English) | B | RAG beyond one citation |
| Full accountability graph view: issue ↔ ward ↔ road ↔ contractor ↔ payment, repeat-failure and anomaly flags | A, B, C | Extends the preliminary's scorecards into the challenge's "knowledge graph" |
| Planning insights: recurring hotspots, road segments repaired repeatedly (rebuild vs patch) | C, D | Secondary benefit for city planning |
| Citizen trust score (verified reports up, fake ones down) | B, E | Personalization + anti-fraud (mistake #5) |
| Offline report queue + low-bandwidth mode | D | UI/UX role must cover low-bandwidth |
| Heatmap, overdue alerts | C | |
| NGO claim board + officer approval | D | Jobs/societal benefit story |
| Open311 (GeoReport v2) compatible API | D | Plug into cities worldwide |
| MCP server exposing CivicTrust tools to AI assistants | B | MCP is a named preferred capability |

### Roadmap only (P2)
Phone-OTP login and per-user permissions, SMS gateway, FCM push, AI weekly ward summary, directions, multi-city tenancy.

---

## 3. Per-component plan to reach the 16–20 band

### A. Innovation & AI-Native Design
- **Lead with what nobody else does:** AI-verified closure. Most civic apps stop at "report"; we stop the city paying for unfinished repairs.
- Show AI is the core, not a chatbot: AI decides type, urgency, duplicates and closure. The guide's mistake #1 is "AI as a gimmick".
- Evidence: live reject of a fake repair photo in the demo.

### B. Technical Excellence & Architecture
- Clean layered architecture matching the guide's reference (UI → app logic → AI → knowledge retrieval → agents → data → integrations → deploy).
- **Model-selection logic documented:** Gemini for vision because it is accurate on day 1 with no training data; Groq for text because it is fast; both swappable by config. Finals: self-hosted YOLO + CLIP for cost, latency and sovereignty.
- **Prompt and context engineering documented:** strict JSON schemas, OSM facts injected as context, explanations written only from computed facts, refusal path when the photo isn't a civic issue.
- Robustness: low-confidence results go to officer review; never auto-reject a citizen.
- Pages in app: `/architecture`, `/data` (sources, lineage, schema).

### C. Business Value & Commercial Viability
- **Customer:** city corporations and municipalities (B2G SaaS, priced per ward). Also donor/development-bank urban programs that need verified-outcome reporting.
- **Measurable value:** public money not paid for unverified repairs; officer hours saved by duplicate merging and ranking; faster fix times.
- **Path:** free pilot in 2–4 wards → paid city contract → national roll-out → export.
- Market sizes and prices must come from cited sources. **No invented numbers.**

### D. Global Scalability & Real-World Impact
- Same problem in every fast-growing city (South Asia, Africa, Southeast Asia); explanations generated in any language; Open311 for integration.
- Stack scales horizontally (managed Postgres, serverless, stateless AI calls).
- Impact: safer roads near schools/hospitals, cleaner streets, citizens get proof of action; NGO/volunteer participation.
- Pilot evidence: real reports from the pilot area, with measured KPIs.

### E. Responsible AI, Data Sovereignty & Presentation
Mandatory commitments from Sec. 15, each mapped to something concrete:

| Commitment | How CivicTrust meets it |
|---|---|
| Lawful, legally sourced data | OSM (ODbL, attributed in the app footer), own photos with consent, ward boundaries only from a licensed source; licences listed on `/data` |
| Transparency in AI decisions | Severity breakdown + one-line reason on every issue; verifier gives reject reason |
| Active bias detection & mitigation | Capped report bonus; per-area report density on public portal to expose under-reporting; accuracy measured per issue type |
| No misleading demos | Live AI only; roadmap labelled as roadmap |
| Privacy / anonymisation | EXIF strip, area-level public location, face/plate blur, no personal data on public portal |
| Data sovereignty | Data-flow doc: photos go to Gemini (`store: false`) and text facts to Groq today; plan to self-host vision models (P1); retention policy |
| Human oversight (extra rigor for CivicSphere) | Officer can override any AI decision; all logged in tamper-evident audit log |

Pages in app: `/security`, `/audit` (one-click report from the audit log + safeguards checklist), model card.

---

## 4. KPIs (must be on screen in the video — M7)

| KPI | How we measure before 31 Oct |
|---|---|
| Issue-type accuracy | Labelled set of real Dhaka photos, held out |
| Repair-verifier accuracy | Real before/after pairs + deliberately bad "repairs" |
| Duplicate merge rate | % of field-test submissions merged |
| Time from photo to ranked ticket | Measured in app (seconds) |
| False-closure rate | Target ≈ 0 with AI verification (measured on test pairs) |
| Pilot targets (to measure after launch) | Median fix time, citizen confirmation rate, overdue % per ward |

Only measured numbers go in the video. Targets are labelled as targets.

---

## 5. The 180-second video (preliminary) — script outline

| Time | Segment (official) | Judges look for | What we show |
|---|---|---|---|
| 0:00–0:30 | **Problem** | Clarity, relevance | Real Dhaka street footage; who suffers (commuters, school children, ambulance routes); reports go nowhere, and **public money is paid for repairs nobody checks**, so citizens stop trusting the system; same accountability gap in cities worldwide. Sourced numbers. |
| 0:30–1:00 | **Solution** | Simplicity, uniqueness | One-line pitch; the 5 roles in one graphic; the differentiator: *AI closes the job only if it's really fixed* |
| 1:00–2:00 | **Demo** | Feasibility, logic | Live, in Bangla: snap → AI result + severity breakdown (10 s) → duplicate prompt (5 s) → officer queue + map, override, assign with cited deadline and agreed cost (15 s) → contractor uploads a **bad** repair → AI rejects with reason, **payment withheld** (10 s) → good repair → approved, payment released (10 s) → citizen confirms → public portal and contractor scorecard update (10 s) |
| 2:00–2:30 | **AI approach** | Depth, structure | Architecture diagram: Gemini vision → severity model (OSM facts) → dedupe (PostGIS + AI) → RAG rules → verifier; Groq explanations; model-selection logic; safeguards |
| 2:30–3:00 | **Impact & next step** | Vision, potential | Measured KPIs; business model; pilot → city → national → global; Nov/Dec roadmap (self-hosted models, agents, graph) |

Same skeleton becomes the 3-minute live pitch on 26 Dec. Keep a recorded backup of the demo in case Wi-Fi fails.

---

## 6. Submission package (Sec. 9.1) — who owns what

| Component | Deliverable | Owner role (Sec. 13.2) |
|---|---|---|
| Problem Definition | 1-page summary: problem, users, need, sourced facts | Business Analyst / Data Scientist |
| AI Architecture | Diagram + `/architecture` page + model-selection notes | Backend / Data Engineer |
| Data & Sovereignty Strategy | `/data` + data-flow + retention + external-API list | Backend / Data Engineer + BA |
| Demo | Deployed app (public URL) + recorded video | UI/UX / Frontend + Presentation Lead |
| Scalability Roadmap | Pilot → city → national → global; infra scaling | Team Leader |
| Ethical Safeguards | `/security`, `/audit`, model card, bias + privacy section | BA / Data Scientist |

### Team roles (mandatory — each must be a named member)
| Role | Member |
|---|---|
| Team Leader / Coordinator | _____ |
| Business Analyst / Data Scientist | _____ |
| UI/UX / Frontend Developer | _____ |
| Backend / Data Engineer | _____ |
| Presentation / Communication Lead | _____ |
| NRB / expert (optional, documented) | _____ |

Check: 3–5 members · ≥1 woman (bonus) · all AI tool usage documented · NRB contributions documented.

---

## 7. Prototype stack (decided 17 Oct)

| Layer | Prototype |
|---|---|
| App | Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind, mobile-first — code in `web/` |
| Backend | Next.js route handlers / server actions; database reachable only from server code |
| Data | Supabase: Postgres + PostGIS + pgvector, Storage (private photo bucket), Realtime |
| AI — vision + embeddings | **Gemini** `gemini-3.8-flash`: issue detection M1, duplicate check M3, repair verification M4, strict JSON; `gemini-embedding-001` (768-d) for policy RAG |
| AI — text | **Groq** `openai/gpt-oss-120b` (primary), strict JSON: Bangla/English explanations, officer copilot. **GLM** `glm-4.5-flash` is the automatic fallback |
| Access | No login. Role + language cookies; database closed to the browser by row-level security |
| Maps | Leaflet + OpenStreetMap, marker clustering |
| Deploy | Vercel + Supabase (public URL) |
| Finals additions | ONNX service (YOLO, CLIP), agent orchestrator |

Data model: `wards`, `pois`, `roads`, `issues`, `reports`, `work_orders`, `repair_proofs`, `citizen_feedback`, `contractors`, `ngos`, `policy_chunks` (embedding), `audit_log` (prev_hash, hash).

Pilot data: Dhanmondi area, Dhaka (bbox 23.735,90.365 → 23.760,90.390). OSM roads + schools + hospitals fetched. Ward boundaries pending (§8). 30–60 real photos to be collected by the team.

---

## 8. Open risks and decisions

| Risk | Impact | Plan | Decide by |
|---|---|---|---|
| **No ward boundaries.** OSM has none for Dhaka; HDX admin level 4 is thanas/unions, not wards | Public portal can't show per-ward numbers | BA/Data finds a licensed source (DNCC/DSCC maps, BBS). **Fallback:** group the portal by clearly labelled "pilot zones" (not official wards) and say so on `/data` | 22 Oct |
| Gemini photo analysis takes ~7 s | Demo feels slow | Show a progress state; try lower thinking level; measure on 30+ photos | 21 Oct |
| Occasional wrong Bangla word in AI reasons (e.g. gravel) | Looks careless in a Bangla demo | Bangla glossary in the prompt; native speaker reviews 20 sample outputs | 25 Oct |
| Database hosted in Sydney (ap-southeast-2) | Judges may ask why Bangladeshi citizens' photos sit in Australia | Either state it on `/data` with the self-hosting roadmap, or recreate the project in Singapore (ap-southeast-1) and replay the migration | 24 Oct |
| OSM tagging noise (some "hospitals" are pharmacies or offices) | Wrong proximity bonus | Name filter in `seed:fetch` (7 removed); officer override covers the rest; noted on `/data` | done |
| Gemini/Groq rate limits or outage during the demo | Live demo stalls | Recorded backup video; GLM takes over text if Groq fails (10 s timeout each); clear error message in app | 27 Oct |
| Not enough real photos (incl. before/after pairs) | KPIs can't be measured | Team photographs 30–60 issues in the pilot area; for repair pairs, revisit fixed spots | 28 Oct |
| Problem statistics unsourced | M2 weak; risk of "fabricated" claims | BA collects cited sources only | 26 Oct |
| Team roles unfilled | Submission requirement (Sec. 13.2) | Fill §6 table | 24 Oct |

---

## 9. Timeline

### Preliminary sprint (17 → 31 Oct)
| Days | Dates | Build | Rubric target | Status |
|---|---|---|---|---|
| 1–2 | 17–18 Oct | Scaffold, schema, AI helpers, severity + tests, role switcher, Bangla/English, OSM data, pilot policy | M5, M6 | **Done** (database live and loaded) |
| 3–5 | 19–21 Oct | Citizen report: camera + GPS, Gemini analysis, explainable severity, Groq reasons | A, B, M3 | **Built 17 Oct**; speed-up pending |
| 6–7 | 22–23 Oct | Dedupe + report counting; officer queue, map, override, assign with RAG citation | B, E | |
| 8–9 | 24–25 Oct | Contractor after-photo + AI verifier; citizen confirm/dispute | A (headline) | |
| 10 | 26 Oct | Public portal (incl. money released vs withheld); contractor scorecards; audit page; EXIF strip; `/architecture` `/data` `/security` `/audit` | D, E | |
| 11 | 27 Oct | Deploy public URL; blur (stretch); polish | M5 | |
| 12 | 28 Oct | Field test in pilot area; measure KPIs | M7, D | |
| 13–14 | 29–30 Oct | Record video per §5; 1-page summary; submission package | M1, M2, M4 | |
| buffer | 31 Oct | **Submit** | | |

### After selection (15 Nov → 25 Dec)
| Window | Work | Rubric target |
|---|---|---|
| Nov | Self-hosted YOLO + CLIP; agent pipeline; offline mode | B, E (sovereignty), D |
| Early Dec | Copilot, full accountability graph + anomaly flags, planning insights, trust score, NGO board, Open311/MCP | A, B, C |
| Mid Dec | Expand pilot, real user feedback, updated KPIs | C, D |
| 20–25 Dec | 3-min pitch rehearsal (timed), backup video, judge Q&A drill | E (presentation) |

---

## 10. Judge Q&A prep (finals)

| Likely question | Answer direction |
|---|---|
| What if the AI is wrong? | Confidence threshold → officer review; officer override logged; citizen can dispute; measured accuracy shown |
| Can a contractor fake the repair photo? | Camera-only capture, GPS ±15 m, capture time, scene match vs. before photo, citizen confirmation |
| Isn't this just another complaint app? | Complaint apps stop at reporting; we verify outcomes, tie payment to verified repairs, and publish them |
| Why Transparent Government, not Smart Nation? | The core value is accountability for public works spending: no payment for unverified repairs, an audit trail nobody can edit, public scorecards. Planning insights are a secondary benefit. |
| Who pays? | City corporations (per-ward SaaS); development programs needing verified outcomes |
| There's no login — is it secure? | The demo uses one-click roles so judges can try it. The database is closed to the browser and every action is audit-logged. Production adds phone-OTP login (roadmap). |
| Privacy of people in photos? | Blur faces/plates, EXIF strip, area-level public view, retention policy |
| Data sovereignty? | Today: photos go to Gemini with `store: false`, text facts to Groq; Nov: self-hosted vision models on city-controlled infra |
| Why Gemini and Groq? | Gemini: strong vision with no training data needed; Groq: fast text; both replaceable by config |
| Bias? | Capped report bonus, per-area under-reporting visibility, accuracy by type |
| How does it scale? | Managed Postgres + serverless + stateless AI; Open311; any language |

---

## 11. Pre-submission self-check

- [ ] All 7 mandatory preliminary items (§1a) visible in the video
- [ ] Video ≤ 180 s and follows the 5 official segments in order
- [ ] Every AI result in the video is live, on real input
- [ ] Bangla shown on screen
- [ ] KPIs shown are measured (targets labelled as targets)
- [ ] All 6 submission components (§6) complete
- [ ] Every team role assigned to a named member
- [ ] AI tool usage + any NRB help documented
- [ ] Data licences and sources listed (OSM ODbL, ward source)
- [ ] Public URL works without login
