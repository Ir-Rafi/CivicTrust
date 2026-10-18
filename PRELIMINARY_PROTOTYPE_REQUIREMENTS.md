# CivicTrust Preliminary Prototype Requirements

## 1. Purpose

CivicTrust is a civic issue reporting and repair accountability prototype. It enables citizens to report public infrastructure problems, uses AI to classify and prioritize reports, and verifies repair evidence before an issue can be marked complete.

The prototype must demonstrate this workflow:

**Report → Analyze → Prioritize → Assign → Verify → Publish outcome**

## 2. Scope

### 2.1 Included

- Mobile-first web application with Bangla as the default language and English support.
- Dhanmondi, Dhaka pilot area with attributed OpenStreetMap roads and nearby facilities.
- Demonstration roles: Citizen, Ward Officer, Contractor, NGO/Volunteer, and Public.
- Camera-based reports containing a photo, location, capture time, issue details, and reporter name.
- AI classification of potholes, road cracks, garbage, open drains, waterlogging, and other civic issues.
- Explainable severity scoring from 1–10.
- Nearby duplicate detection and duplicate report merging.
- AI-generated Bangla and English explanations.
- Officer queue and map with filters, prioritization, and human override.
- Contractor work orders with cost, deadline, and policy reference.
- Repair proof upload and AI-based before/after verification.
- Payment status withheld until repair verification succeeds.
- Citizen confirmation or dispute of a reported repair.
- Public status dashboard and contractor performance summary.
- Hash-chained audit records for important actions and AI decisions.

### 2.2 Excluded

- Production authentication, phone verification, and granular permissions.
- Full city coverage, multi-city tenancy, and offline synchronization.
- SMS, push notifications, Open311 integration, and automated bank payments.
- Self-hosted vision models, agent orchestration, and a full graph interface.
- Claims of production-level accuracy or official government policy.

## 3. User Requirements

| User | Required capability |
|---|---|
| Citizen | Submit a report, view its status, and confirm or dispute a repair |
| Ward Officer | Review, prioritize, correct, assign, and verify issues |
| Contractor | View assigned work and submit repair evidence |
| NGO/Volunteer | View open issues and indicate willingness to assist |
| Public | View area-level issue status and contractor outcomes |

The prototype may use a role switcher for demonstration and shall identify it as a prototype access mechanism.

## 4. Functional Requirements

### FR-01: Report submission

The system shall allow a citizen to capture an image from the browser camera and submit it with location and capture time. It shall reject unsupported files, files larger than 4 MB, stale reports, and invalid timestamps with a clear message.

### FR-02: AI issue analysis

The system shall return structured results containing civic or non-civic classification, issue type, visual severity, confidence, factual observations, visible hazards, and face or number-plate visibility. Non-civic images shall be rejected and shall not be stored as reports.

### FR-03: Explainable severity

The system shall calculate a deterministic score from 1–10 using visual severity, road class, distance to nearby sensitive locations, report count, and days open. The interface shall display the score components, and repeated reports shall have a capped contribution.

### FR-04: Duplicate detection

The system shall search for open issues within 25 metres and compare images to determine whether a new report is a duplicate. Confirmed duplicates shall be linked to the existing issue.

### FR-05: AI explanation

The system shall generate concise English and natural Bangla explanations based only on computed facts. Groq shall be the primary text provider, with GLM as an automatic fallback. Each provider has a timeout so a slow provider cannot block the report. If both providers fail, the report shall remain available with its factual observations.

### FR-06: Officer review and override

The officer interface shall provide a severity-ranked queue, map, and filters by status, issue type, and area. Officers shall be able to correct AI results by providing a reason. The original result and correction shall both be auditable.

### FR-07: Work order

An officer shall be able to assign an issue with a responsible party, agreed cost, deadline, and policy reference where available.

### FR-08: Repair verification

The contractor shall submit an after-photo captured at the repair location. The system shall check photo freshness and location tolerance, compare before and after images, and return resolved, partially resolved, unresolved, or unclear.

### FR-09: Payment status

Payment shall remain withheld until the repair is verified. Rejected or unclear results shall require officer review. A verified repair shall be marked eligible for release in the prototype.

### FR-10: Public outcome

The public interface shall show area-level open and fixed issues, available fix-time statistics, and contractor outcomes. It shall not expose personal information or exact private coordinates.

### FR-11: Audit trail

The system shall record report creation, AI decisions, duplicate decisions, overrides, assignments, repair evidence, verification results, citizen feedback, and payment status. Records shall be tamper-evident and append-only through the application workflow.

## 5. Technical Requirements

- Next.js, TypeScript, and a responsive web interface.
- Supabase Postgres with PostGIS, pgvector, Storage, and row-level security.
- Gemini for image analysis, image comparison, and policy embeddings.
- Groq for primary text explanations and GLM as fallback.
- Zod validation for all model responses.
- Server-only database access and environment-based secret management.
- EXIF removal after reading required metadata.
- Gemini image requests configured with `store: false`.
- OpenStreetMap attribution and licence information in the product.

## 6. Required Screens

1. Role and language selection.
2. Citizen report capture and submission status.
3. Issue result with severity breakdown and bilingual explanation.
4. Officer queue and map.
5. Issue detail with audit history and override controls.
6. Work order with cost, deadline, and policy reference.
7. Contractor repair submission and verification result.
8. Citizen confirmation or dispute.
9. Public transparency dashboard and contractor summary.
10. Architecture, data, security, and model-card pages.

## 7. Acceptance Criteria

The prototype shall be accepted when a reviewer can:

1. Select Bangla and submit a real civic issue photo.
2. View live AI classification, confidence, severity components, and bilingual explanation.
3. Submit a nearby duplicate and see it linked to the existing issue.
4. Review the issue in the officer queue and map.
5. Override an AI result with a reason and view the audit entry.
6. Assign a contractor with a cost, deadline, and policy reference.
7. Submit an invalid repair photo and show rejection with payment withheld.
8. Submit a valid repair photo and show verification and payment eligibility.
9. Confirm or dispute the repair as a citizen.
10. View the resulting status and contractor outcome publicly.

All AI results shown must be live or explicitly labelled as recorded test results. Hard-coded output must not be presented as live AI output.

## 8. Required Measurements

The team shall measure and document issue classification accuracy, repair verification accuracy, duplicate merge rate, median time from submission to ranked issue, false-closure rate, audit-record completion rate, and AI provider success and fallback rates.

Measured results and future targets must be clearly separated.

## 9. Deliverables

- Working prototype source code.
- Setup and deployment documentation.
- Requirements, architecture, data, privacy, and security documentation.
- Model card and responsible-AI safeguards.
- KPI measurement summary.
- Preliminary demonstration video.
- Participant guide and supporting submission materials.

## 10. Completion Definition

The preliminary prototype is complete when the end-to-end accountability workflow operates successfully, the acceptance demonstration is reproducible, safeguards are documented, and measured results and known limitations are ready for presentation.
