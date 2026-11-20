# CivicTrust: judge-aligned plan

Built from the official rules in `AIBC_Participants_Guide_261015_143157.pdf` (Sections 9, 11, 13, 14, 15, 20) and the product spec in `CivicTrust.pdf`.
Updated: 21 Oct 2026. **Preliminary closes 31 Oct 2026.**

Every feature, page and minute of video below exists because it earns points somewhere in the rules. If it doesn't score, it's cut or moved later.

---

## Status at a glance (20 Nov)

| Area | State |
|---|---|
| Decisions | Next.js + Supabase · Gemini (vision, embeddings) + Groq (text, GLM fallback) · **no login** (role switcher) · pilot area Dhanmondi, Dhaka |
| Core loop | **Built and verified end to end** on the live database: citizen report (GPS, map, manual pin, place names) → AI analysis → duplicate merge → explainable severity → Bangla/English reason → officer queue, map, area filter, corrections with history → work order with cited deadline and cost → repair verification (location, freshness, AI) → payment withheld until verified → citizen confirm/dispute → public tracker, update log, scorecards, per-area figures |
| Safeguards | Hash-chained audit log that can't be edited or emptied; payment gate in the database; unsure AI results go to an officer; unmeasured repair locations never auto-approve; RLS on every table; photos never public |
| Screens | All §6 screens, including `/architecture`, `/data`, `/security`, `/model-card`, `/audit`, `/impact` and `/docs`; Bangla/English; dark mode |
| Added since 21 Oct | Gemini and Groq key pools with four backup vision models; live `/docs`; read-only MCP server (`/api/mcp`, six tools); "Ask CivicTrust" officer assistant (Mastra agent, read-only tools); daily overdue-repair check (Vercel Cron, n8n workflow); optional local model (Ollama, `qwen2.5:3b`) reachable through a token-checked Cloudflare Tunnel |
| Live | `civictrust-eight.vercel.app` (main demo and submission URL) and `civic-trust-siuu.vercel.app` (backup), both in Singapore (`sin1`) on the Singapore database. Vercel Hobby only deploys the account owner's commits |
| Impact evidence | Expected outcomes with KPIs; `/impact` computes the figures live with sample sizes. Little real data yet: a measurement run with real reports is still to do (no paid Gemini key; the free key pool is used) |
| Validation limits | Free Gemini keys often return *high demand* errors; the key pool and backup models usually answer. Desktop runs do not establish field GPS, real repair quality or field performance |
| Next | Preliminary submission on Cloudcamp (deadline 20 Nov, 11:59 PM Bangladesh time) → finals preparation |

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
| M4 | Basic system flow input → AI → output | Architecture diagram + demonstration | Data, AI decisions and outputs are understandable |
| M5 | Initial demo / prototype / workflow | Prototype demonstration or clearly labelled system walkthrough | Show executed actions accurately and distinguish illustrative steps |
| M6 | Bangla / localization | Bangla UI (default) + Bangla AI explanations | Demo shown in Bangla |
| M7 | Defined potential impact (KPIs or expected outcomes) | Expected-outcomes table in Docs/KPI_SUMMARY.md | Explain potential benefits; distinguish unmeasured KPIs, targets and actual results |

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
| "Ask CivicTrust" officer copilot (RAG over rules + live issue data, Bangla/English) | B | Implemented 19 Nov: Mastra agent on Groq with seven read-only tools on the officer page; answers cite issue IDs and policy sections and are logged |
| Full accountability graph view: issue ↔ ward ↔ road ↔ contractor ↔ payment, repeat-failure and anomaly flags | A, B, C | Extends the preliminary's scorecards into the challenge's "knowledge graph" |
| Planning insights: recurring hotspots, road segments repaired repeatedly (rebuild vs patch) | C, D | Secondary benefit for city planning |
| Citizen trust score (verified reports up, fake ones down) | B, E | Personalization + anti-fraud (mistake #5) |
| Offline report queue + low-bandwidth mode | D | UI/UX role must cover low-bandwidth |
| Heatmap, overdue alerts | C | Overdue alerts implemented 19 Nov: daily check (Vercel Cron or n8n), officer queue flag, public update log. Heatmap still open |
| NGO claim board + officer approval | D | Jobs/societal benefit story |
| Open311 (GeoReport v2) compatible API | D | Plug into cities worldwide |
| MCP server exposing CivicTrust tools to AI assistants | B | Implemented: six read-only tools at `/api/mcp`; see `Docs/MCP_GUIDE.md`. Hosted deployment and assistant demonstration must be verified separately. |

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

## 4. Expected outcomes and planned KPIs (M7)

| Expected outcome | Later evaluation |
|---|---|
| Faster report triage | Submission-to-ranked-issue time, median and p90 |
| Less duplicate case handling | Merge rate plus correct/incorrect matches on labelled examples |
| Fewer incorrect repair closures | False approvals on labelled negative repair pairs |
| More accountable payment status | Approved-evidence coverage of recorded payment releases |
| More transparent service progress | Later user task-completion and understanding tests |
| Traceable and resilient workflow | Audit completion and AI provider success/fallback rates |

Section 9.2 accepts KPIs or expected outcomes. The preliminary presents expected outcomes, and the
`/impact` page shows each KPI computed live from the system with its sample size and status
(*No data yet*, *Early data*, *Measured*). No field accuracy, real-world time saving or financial
saving is claimed. Any numerical target is labelled as team-proposed.

Procedure and submission wording: [Docs/KPI_SUMMARY.md](Docs/KPI_SUMMARY.md). Field GPS, real
repair validation and user studies remain pilot work.

---

## 5. The 180-second video (preliminary) — script outline

| Time | Segment (official) | Judges look for | What we show |
|---|---|---|---|
| 0:00–0:30 | **Problem** | Clarity, relevance | Explain users and the repair-accountability problem with sourced facts or licensed reference visuals. New on-site footage is not required. |
| 0:30–1:00 | **Solution** | Simplicity, uniqueness | One-line pitch; the 5 roles in one graphic; the differentiator: *AI closes the job only if it's really fixed* |
| 1:00–2:00 | **Demo** | Feasibility, logic | Desktop demonstration in Bangla: labelled sample report and demo location → actual AI result or clear error → officer queue and assignment → repair safeguard/review flow → public and audit views for completed actions. Show that unmeasured work-site coordinates cannot auto-approve. Explain unexecuted steps as a walkthrough. |
| 2:00–2:30 | **AI approach** | Depth, structure | Architecture diagram: Gemini vision → severity model (OSM facts) → dedupe (PostGIS + AI) → RAG rules → verifier; Groq explanations; model-selection logic; safeguards |
| 2:30–3:00 | **Impact & next step** | Vision, potential | Expected benefits and planned KPIs, any separately verified results, business model, and later field validation and expansion. |

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
| Data | Supabase (Singapore): Postgres + PostGIS + pgvector, Storage (private photo bucket) |
| AI — vision + embeddings | **Gemini** `gemini-3.8-flash`: issue detection M1, duplicate check M3, repair verification M4, strict JSON; `gemini-embedding-001` (768-d) for policy RAG |
| AI — text | **Groq** `openai/gpt-oss-120b` (primary), strict JSON: Bangla/English explanations, officer copilot. **GLM** `glm-4.7-flash` is the automatic fallback; an optional local **Ollama** model (`qwen2.5:3b`) is tried last where configured |
| Access | No login. Role + language cookies; database closed to the browser by row-level security |
| Maps | Leaflet + OpenStreetMap |
| Deploy | Vercel (`sin1`) + Supabase (public URL) |
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
| Database hosted outside Bangladesh | The Personal Data Protection Ordinance 2025 requires restricted data to stay in Bangladesh (18-month transition) | Moved to Singapore (ap-southeast-1), the closest Supabase region: migrations replayed, data copied, audit chain checked. Stated on `/data`; a Bangladesh-hosted Postgres is the plan before a real rollout | done |
| OSM tagging noise (some "hospitals" are pharmacies or offices) | Wrong proximity bonus | Name filter in `seed:fetch` (7 removed); officer override covers the rest; noted on `/data` | done |
| Gemini/Groq rate limits or outage during the demo | Live demo stalls | Recorded backup video; GLM takes over text if Groq fails (10 s timeout each); clear error message in app | 27 Oct |
| Physical field access unavailable | Field accuracy and real-world impact remain unvalidated | Present expected outcomes, the live `/impact` figures and a labelled desktop demonstration; physical validation is pilot work | Preliminary |
| Free Gemini key overloaded (503) or rate-limited (429) | Photo analysis fails during the measurement run or recording | Key pool across free-tier projects and four backup vision models with staggered fallback (no paid key available); recorded backup video | done |
| Supabase free project pauses after a week without activity | Live demo breaks while judges review it | Uptime monitor on `/api/health` (keyword check) | 25 Oct |
| Problem statistics unsourced | M2 weak; risk of "fabricated" claims | BA collects cited sources only | 26 Oct |
| Team roles unfilled | Submission requirement (Sec. 13.2) | Fill §6 table | 24 Oct |

---

## 9. Timeline

### Preliminary sprint (17 → 31 Oct)
| Days | Dates | Build | Rubric target | Status |
|---|---|---|---|---|
| 1–2 | 17–18 Oct | Scaffold, schema, AI helpers, severity + tests, role switcher, Bangla/English, OSM data, pilot policy | M5, M6 | **Done** (database live and loaded) |
| 3–5 | 19–21 Oct | Citizen report: camera + GPS, Gemini analysis, explainable severity, Groq reasons | A, B, M3 | **Done**; plus map, manual pin, place names, AI time limits |
| 6–7 | 22–23 Oct | Dedupe + report counting; officer queue, map, override, assign with RAG citation | B, E | **Done** (19 Oct); plus history, area filter, NGO offers |
| 8–9 | 24–25 Oct | Contractor after-photo + AI verifier; citizen confirm/dispute | A (headline) | **Done** (19 Oct) |
| 10 | 26 Oct | Public portal (incl. money released vs withheld); contractor scorecards; audit page; EXIF strip; `/architecture` `/data` `/security` `/audit` | D, E | **Done** (19 Oct); plus `/model-card` |
| 11 | 27 Oct | Deploy public URL; blur (stretch); polish | M5 | Deployed; blur not built (photos never public) |
| 12 | 28 Oct | Measurement run on the live site; `/impact` figures into the KPI summary | M7, D | `/impact` built (21 Oct); run with real reports still to do (free key pool, no paid key) |
| 13–14 | 29–30 Oct | Record video per §5; 1-page summary; submission package | M1, M2, M4 | Video (2:56) and one-page summary done |
| buffer | 20 Nov | **Submit** (Cloudcamp deadline moved to 20 Nov, 5:59 PM UTC) | | |

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
- [ ] Executed AI results are from actual live or labelled recorded requests; demo data and illustrative steps are identified
- [ ] Bangla shown on screen
- [ ] Expected outcomes, proposed targets and verified measurements are clearly distinguished
- [ ] All 6 submission components (§6) complete
- [ ] Every team role assigned to a named member
- [ ] AI tool usage + any NRB help documented
- [ ] Data licences and sources listed (OSM ODbL, ward source)
- [ ] Public URL works without login
