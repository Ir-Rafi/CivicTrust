# CivicTrust Preliminary-Round Prototype Requirements

**Version:** 1.0  
**Target submission:** 31 October 2026  
**Prototype area:** Dhanmondi, Dhaka  
**Primary audience:** Preliminary-round judges and pilot stakeholders

## 1. Purpose

CivicTrust is a civic issue reporting prototype for the International AI Builders Congress preliminary round. A citizen submits a photo of a public infrastructure problem, AI classifies and ranks it, and an officer can track the issue through assignment and repair verification.

The prototype must demonstrate one complete, believable accountability loop:

> **Report → understand → rank → assign → verify → publish the outcome**

The preliminary prototype is judged on a clear problem, a working workflow, meaningful AI use, Bangla localization, measurable impact, and responsible handling of data. Features that do not support this loop are outside the required scope.

## 2. Scope

### Included in the preliminary prototype

- A mobile-first web application with Bangla as the default language and English available.
- Five demo roles: Citizen, Ward Officer, Contractor, NGO/Volunteer, and Public.
- A Dhanmondi pilot map with roads, schools, hospitals, and clinics from attributed OpenStreetMap data.
- Camera-based citizen reporting with photo, location, capture time, issue details, and reporter name.
- Gemini vision analysis for civic issue detection, issue type, visual severity, confidence, hazards, and privacy flags.
- Explainable severity scoring from 1–10 using visual severity, road class, nearby sensitive places, report count, and days open.
- Duplicate detection using a 25 metre geospatial search and an AI image comparison.
- GLM as the primary provider for short Bangla and English explanations, with Groq as fallback.
- Officer queue and map ordered by severity, with filters and human override.
- Contractor work order with agreed cost, deadline, and policy citation where available.
- Repair proof capture at the repair location and time.
- AI repair verification using location, freshness, and before/after image comparison.
- Payment status that remains withheld until a repair is verified.
- Citizen confirmation or dispute of the repair result.
- Public issue status and contractor scorecard views.
- Hash-chained audit records for AI decisions, overrides, assignments, status changes, and payment state.
- A model card, data-flow explanation, safeguards page, and preliminary demo video.

### Excluded from the preliminary prototype

- Production authentication, phone OTP, or fine-grained user permissions.
- Full city coverage or multi-city tenancy.
- Offline synchronization, SMS, push notifications, and Open311 integration.
- Self-hosted vision models, agent orchestration, and a full knowledge-graph interface.
- Automated payment transfer to a bank or government payment system.
- Claims that the prototype represents official city policy or production accuracy.

## 3. Users and permissions

| User | Required capability |
|---|---|
| Citizen | Submit a report, view its status, and confirm or dispute a repair |
| Ward officer | Review the ranked queue, inspect evidence, override AI results with a reason, assign work, and approve or reject repairs |
| Contractor | View assigned work, upload a repair proof, and see the verification result |
| NGO/volunteer | View open issues and indicate willingness to help |
| Public | View area-level open and fixed issues, outcomes, and contractor performance |

The prototype uses a role switcher for demonstrations. The interface must make clear that this is a controlled prototype and not an identity or access-control system.

## 4. Functional requirements

### FR-01 — Citizen report

The system shall allow a citizen to capture a JPEG, PNG, or WebP photo from the browser camera. It shall record the capture time, GPS coordinates when available, location source, and reporter name. Files larger than 4 MB, unsupported types, stale GPS reports, and invalid timestamps shall be rejected with a clear message.

### FR-02 — Civic issue analysis

The system shall send the image to the configured vision provider and return strict structured data containing:

- civic issue or non-civic classification;
- issue type: pothole, road crack, garbage, open drain, waterlogging, or other;
- visual class: minor, moderate, or severe;
- confidence;
- factual observations;
- visible hazards;
- whether faces or number plates are visible.

Non-civic images shall be rejected and shall not be stored as reports.

### FR-03 — Severity score

The system shall calculate a deterministic score from 1–10 and show its components. The score shall include visual class, road class, distance to nearby schools or hospitals, report count, and days open. The report-count bonus must be capped so repeated submissions cannot overwhelm the other factors.

### FR-04 — Duplicate handling

The system shall search for nearby open issues within 25 metres and use image comparison to classify a possible duplicate as yes, no, or unclear. A confirmed duplicate shall be linked to the existing issue and counted without creating an unnecessary new issue.

### FR-05 — Explanation

The system shall generate one concise English explanation and one natural Bangla explanation from the computed facts only. GLM shall be attempted first. Groq shall be used automatically if GLM is unavailable or fails. If both providers fail, the report shall retain the measured observations and continue.

### FR-06 — Officer queue and override

The officer view shall show open issues ordered by severity and support filtering by status, issue type, and area. An officer shall be able to correct an AI classification or severity and must provide a reason. The original AI result and the override shall both remain auditable.

### FR-07 — Assignment and deadline

The officer shall create a work order containing an assignee, agreed cost, deadline, and issue reference. The deadline shall be derived from the severity and cite the applicable pilot policy rule when a matching policy chunk exists.

### FR-08 — Repair verification

The contractor shall upload an after-photo captured at the work location. The system shall check photo freshness and location tolerance of approximately 15 metres, compare the before and after images, and return resolved, partially resolved, unresolved, or unclear with a reason.

### FR-09 — Payment gate

The work order shall show payment as withheld until the repair is verified. A rejected or unclear verification shall keep payment withheld and route the case to officer review. A verified repair shall mark payment as eligible for release in the prototype.

### FR-10 — Citizen and public outcome

Citizens shall be able to confirm or dispute a repair. The public view shall show area-level locations, open versus fixed counts, average fix time where data exists, and contractor outcomes without exposing exact private coordinates or personal data.

### FR-11 — Audit trail

The system shall record report creation, AI results, duplicate decisions, overrides, assignments, repair proofs, verification decisions, citizen feedback, and payment state. Audit entries shall be hash-chained and append-only from the application workflow.

## 5. AI and data requirements

- Gemini shall handle image analysis, duplicate comparison, repair comparison, and policy embeddings.
- GLM shall be the primary text explanation provider through its OpenAI-compatible API.
- Groq shall remain configured as the text fallback.
- All model outputs used by the application shall be parsed against Zod schemas.
- Prompts shall instruct models to report only visible or computed facts and to refuse unsupported claims.
- Gemini image requests shall use `store: false`.
- Stored photos shall have EXIF metadata removed after reading location and time.
- Exact report coordinates shall be restricted to officer and contractor views; the public view shall use area-level locations.
- OSM data shall include attribution and its ODbL licence notice.
- The product shall label measured results, targets, roadmap items, and simulated demo data separately.

## 6. Non-functional requirements

### Reliability

- A provider failure shall produce a useful fallback or an explicit review state.
- Low-confidence analysis shall be reviewable by an officer and shall not silently delete a citizen report.
- The system shall preserve the issue record when an optional explanation call fails.

### Performance

- The report flow shall display progress for long AI calls.
- The team shall measure and record time from photo submission to ranked issue.
- The preliminary demo should complete the core report flow within a practical live-demo window.

### Security and privacy

- Database access shall occur only through server-side code.
- Row-level security shall be enabled on database tables.
- Secrets shall remain in `web/.env.local` or deployment secret storage and shall never be committed.
- Public pages shall not expose personal names, exact private coordinates, raw provider keys, or unredacted sensitive images.

### Accessibility and localization

- Bangla shall be the default interface language.
- Important actions shall have clear labels and visible success or error states.
- The demo shall work on a mobile viewport and a desktop judge laptop.

## 7. Required screens

1. Role and language switcher.
2. Citizen report capture and submission progress.
3. Citizen issue result with severity breakdown and bilingual explanation.
4. Officer queue and map.
5. Issue detail with audit history and override control.
6. Work order with deadline, cost, and policy citation.
7. Contractor repair upload and verification result.
8. Citizen confirmation or dispute.
9. Public transparency dashboard and contractor scorecard.
10. Architecture, data, security, and model-card pages for judges.

## 8. Acceptance criteria for the preliminary demo

The prototype is ready when a reviewer can complete this script on a deployed or local instance:

1. Select Bangla and the Citizen role.
2. Capture a real civic issue photo in the Dhanmondi pilot area.
3. See live AI classification, confidence, severity components, and Bangla/English explanation.
4. Submit a second nearby photo and see duplicate handling.
5. Switch to Officer and see the issue in the ranked queue and map.
6. Override a field with a written reason and see the audit entry.
7. Assign a contractor with a cost, deadline, and policy citation.
8. Switch to Contractor and upload a deliberately bad after-photo.
9. Show AI rejection, reason, and payment withheld.
10. Upload a valid after-photo and show verification and payment eligibility.
11. Switch to Citizen and submit confirmation or dispute.
12. Switch to Public and show the area-level outcome and contractor scorecard.

The video must show live or clearly labelled recorded results. It must not present hard-coded output as a live AI decision.

## 9. Measures to collect before submission

The team shall record measured values for:

- issue-type accuracy on a labelled Dhaka photo set;
- repair-verifier accuracy on valid and deliberately bad repair pairs;
- duplicate merge rate;
- median time from photo submission to ranked ticket;
- false-closure rate;
- percentage of reports with a complete audit trail;
- provider success and fallback counts during testing.

Targets must be labelled as targets. Only measured values may be presented as results in the preliminary video.

## 10. Deliverables

- Working source code in the `web/` application.
- `README.md` and `web/README.md` with setup, architecture, and environment variables.
- Preliminary demo video of no more than three minutes.
- Problem definition and user summary.
- AI architecture and model-selection explanation.
- Data, licence, sovereignty, retention, and privacy notes.
- Model card and responsible-AI safeguards.
- Measured KPI sheet.
- Participant guide and submission materials.

## 11. Completion rule

The preliminary prototype is complete when the core accountability loop works end to end, the acceptance script can be demonstrated using live or clearly labelled recorded evidence, the documented safeguards are visible to judges, and the measured KPI and limitation statements are ready for the video.
