# Testing and debugging guide

How to run the CivicTrust prototype, test everything built so far, and debug problems.
The acceptance criteria these tests follow are in
[`PRELIMINARY_PROTOTYPE_REQUIREMENTS.md`](PRELIMINARY_PROTOTYPE_REQUIREMENTS.md) (§7, AC1–AC10).

> **Before you start**
> - **Shared database.** Your local app talks to the same hosted Supabase database as the team
>   and the Vercel deployment. Everything you create is visible on the public portal. Clean up
>   test issues when you are done (see [Cleaning up](#cleaning-up-test-data)).
> - **Shared AI quota.** The Gemini key is on the free tier: about **20 photo checks per day for
>   the whole team**. Each citizen report uses 1–3; each repair check uses 1. Coordinate before
>   running many reports.
> - **No faces or number plates.** Blurring is not built yet, so photograph only the problem.

## 1. Run it

Requirements: Node 24 (`nvm use` in the repo root reads `.nvmrc`), pnpm, and `web/.env.local`
from the team lead. Never commit `.env.local`, and never put real values in `.env.example`.

```bash
cd web
pnpm install
pnpm dev                                  # http://localhost:3000
```

Open <http://localhost:3000/api/health>. Expected:
`configured` all `true`, `database.ok: true`, `pois: 219`, `roads: 810`, `wards: 0`.

Automated checks (GitHub CI runs the same on every push):

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
pnpm smoke:ai                 # live: Groq + GLM explanations and the policy search
pnpm smoke:ai photo.jpg       # also runs the Gemini photo analysis (uses 1 quota)
```

## 2. How to drive the prototype

- **No login.** The header tabs switch role: Citizen, Ward officer, Contractor, NGO / volunteers,
  Public portal, plus Audit. The globe button switches Bangla ↔ English (Bangla is the default).
  Both are cookies (`ct_role`, `ct_lang`).
- **Personas.** Actions are recorded as *Demo Citizen*, *Demo Ward Officer*, *Demo Contractor* or
  *Demo NGO*. Every tester in the citizen role is the same Demo Citizen.
- **Contractor and NGO screens** have a **Viewing as** selector to pick the company
  (*Demo Contractor A*, *Demo Contractor B*, *Demo Volunteer Group*). The URL keeps it as
  `?who=<id>&wo=<work order id>`.
- **Laptop shortcuts.**
  - Citizen: **Use a demo location in the pilot area instead** offers 4 real Dhanmondi spots.
    Demo reports skip the 30-minute photo-age check and are stored as location source `demo`.
  - Contractor: **Use the work site location (demo, for laptop testing)** sends the issue's own
    coordinates. See [known issue 1](#known-issues).

## 3. Testing on a phone

| Link | How | What works |
|---|---|---|
| `http://<Mac IP>:3000` | Same Wi-Fi; get the IP with `ipconfig getifaddr en0` | Everything **except GPS**: browsers only give location to `https://` pages |
| `https://….ngrok-free.dev` | `ngrok http 3000` on the Mac | Everything, including GPS. The link is public: stop ngrok when done |

Expected GPS accuracy: phone outdoors ±5–15 m. A Mac has no GPS chip, so it estimates from Wi-Fi
(±50–200 m). The camera button works on both links.

## 4. Test scenarios

Tick them off in your copy. **AC** = acceptance criterion in the requirements.

### A. Citizen report (AC1–AC3)

- [ ] **A1 Report from a laptop.** Citizen → **Take photo** (pick a real pothole or garbage photo)
  → tick the demo location, choose *Road 16* → **Send report**.
  - Before sending: map with a pin, and below it the place name: road, area and city, then the
    nearest school or hospital, e.g. *Road 16 · Bashbari, Lalmatia, Dhaka Metropolitan · near
    Oxford International School*.
  - After 10–30 s: the issue page shows the type, AI confidence, severity score with its factor
    breakdown, a one-line reason in Bangla and English, and the status.
- [ ] **A2 Report with real GPS** (phone via ngrok). The status shows *Improving accuracy… now ±N m*,
  then *GPS location found (±N m)*.
  - Circle colour on the map: green ≤ 15 m, amber ≤ 25 m, red > 25 m.
  - When red, a warning appears with **Refresh location**.
  - The place name shows your road, area and city (in Bangla or English). The house number
    appears only when the fix is within 15 m.
  - Outside the Dhanmondi pilot area you still get the name, plus a note that roads and schools
    there are not counted in the severity score.
- [ ] **A3 Not a civic problem.** Report a selfie or a room → *This doesn't look like a public road,
  drain or garbage problem.* Nothing appears under My reports.
- [ ] **A4 Old photo.** With GPS (not demo), upload a photo whose file date is more than 30
  minutes old → *This photo is too old. Take a new photo at the spot.*
  A freshly downloaded photo gets a new file date and will pass, so use one from the phone's gallery.
- [ ] **A5 Not an image.** A file that isn't a real image (e.g. a `.txt` renamed to `.jpg`) →
  *Please use a JPG, PNG or WebP photo under 4 MB.*
  Large photos are shrunk in the browser first, so the 4 MB limit can't be hit from the app.
- [ ] **A6 Duplicate.** Report the same problem again at the same spot. If the AI agrees it is the
  same problem → *This problem was already reported nearby…* The report count goes up by 1 and the
  severity may rise (+0.5 per extra report, at most +1).

### B. Ward officer (AC4–AC6)

- [ ] **B1 Queue and map.** Issues are sorted by severity.
  - Filters: Open, Needs assignment, Critical (8+), Action needed, All, plus Type.
  - Map pins are coloured by severity. Clicking a row or pin opens the detail.
- [ ] **B2 Correct the AI.** **Correct the AI** → change the visual severity, type or score, write a
  reason → **Save correction**.
  - The score breakdown updates.
  - The Audit tab shows `ai_override` by Demo Ward Officer.
  - Saving without a reason → *Write a reason (at least 3 characters).*
  - A later duplicate report keeps the officer's score.
- [ ] **B3 Assign.** **Assign the repair** → *Demo Contractor A*, agreed cost → **Create work order**.
  - Payment shows *Withheld*, and a *Deadline rule* citation from `pilot-sla-policy.md` appears.
  - Deadline by severity: 8–10 → 48 h, 5–7 → 7 days, 3–4 → 14 days, 1–2 → 30 days.
  - Assigning again → *issue already has an active work order (#N)*.

### C. Contractor repair and payment (AC7, AC8)

- [ ] **C1 Rejected repair (laptop).** Contractor → **Viewing as** *Demo Contractor A* → open the
  work order → **Take the after-photo** → leave the work-site box unticked →
  **Submit for AI verification**.
  - Expected: *Verification result: Rejected* with *The repair photo is N metres from the issue;
    the limit is 15 metres.*, and *Payment withheld*.
  - An old photo is rejected with *…older than the allowed verification window.*
- [ ] **C2 Approved repair (needs a real place).**
  1. On a phone (ngrok), report a small pile of rubbish on a road or footpath where you stand.
  2. As officer, assign it to Contractor A.
  3. Clear the rubbish away.
  4. Within 30 minutes, as contractor, submit the after-photo from the same spot.

  Expected: *Verification result: Approved by AI*, *Payment can now be released*, and the issue
  becomes **Fixed**. If the AI is unsure, you get *Sent to officer* instead.
- [ ] **C3 Officer review.** For a repair *Sent to officer*: Ward officer → **Action needed**
  (repairs waiting for review and payments to release) → open the issue → compare both photos →
  **Approve repair** or **Reject repair** with a reason.
  - Approve → payment eligible, issue Fixed.
  - Reject → issue back to Assigned, and the crew can submit again.
- [ ] **C4 Release payment.** On an approved repair → **Release payment** → *Released*.
  - It must fail while the issue is Disputed.

### D. Citizen confirm or dispute (AC9)

- [ ] **D1** Citizen → open the fixed issue from My reports → *Was it really fixed?*
  - **Yes, it's fixed** → Confirmed.
  - **No, dispute the repair** → Disputed. The work order goes back to the officer, and payment is
    withheld until the officer decides.

  The form only appears when the issue is **Fixed** and you are in the citizen role.

### E. Public portal and audit (AC10, FR-11)

- [ ] **E1 Public portal.**
  - **Reported problems:** type, road, nearest landmark, and *Reported → Assigned → Fixed* with
    dates.
  - **Live updates:** each report, assignment, fix, dispute and confirmation appears. Rejected or
    unsure repair attempts do not.
  - Below: totals, money paid and withheld, contractor scorecards, and per-area figures (one pilot
    zone until ward boundaries exist).
  - **Privacy:** no names, comments, coordinates or hash codes anywhere on the page.
- [ ] **E2 Scorecards.** A disputed or rejected job stays on the original contractor's card even
  after the issue is reassigned.
- [ ] **E3 Audit page.** *All records verified · N records checked. None has been altered or deleted.*
  - As officer: a Hash column and real names.
  - As public or citizen: names show as *Citizen*, comments are hidden, and there is no Hash column.

### F. General

- [ ] **F1** Every screen in Bangla and English: Bangla digits, natural Bangla AI reasons.
- [ ] **F2** `/architecture`, `/data` and `/security` load.
- [ ] **F3** Phone-width layout: nothing is cut off and there is no sideways scrolling.
- [ ] **F4** Open `/officer` while in the citizen role → you are asked to switch role.
- [ ] **F5** Maps survive navigation: open the officer queue (map) and the citizen report form
  (location map), go to another tab and come back. Both maps must show again. Cache Components
  keeps visited pages alive but hidden, and maps that don't handle that come back blank.
- [ ] **F6** Fallbacks:
  - With the Gemini quota used up, a citizen report shows *Something went wrong* (the terminal shows
    `429 RateLimitError`).
  - A repair whose location checks pass goes to the officer with *AI verification was unavailable*.

## 5. Debugging

**Where to look first**

- **Terminal running `pnpm dev`.** Server errors appear here, and browser console errors are
  forwarded as `[browser] …` lines. The same log is saved to `web/.next/dev/logs/next-development.log`.
- **`/api/health`** shows which keys are configured and whether the database answers.
- **`pnpm smoke:ai`** tests the AI services without the UI.
- **A form says "Something went wrong"?** The real error is in the terminal.

**Common problems**

| Symptom | Cause | Fix |
|---|---|---|
| Page has no styling | Old stylesheet from a stale Next.js cache | Stop dev, `rm -rf web/.next`, start again, hard refresh (⌘⇧R) |
| Your CSS change doesn't show | Edits to `globals.css` don't hot-reload ([known issue 3](#known-issues)) | Restart `pnpm dev` |
| Page reloads endlessly (VS Code's built-in browser) | Stale tab left over from earlier dev-server runs | Close the tab and use Chrome |
| *Couldn't get GPS location* on a phone | `http://` LAN link | Use the ngrok `https://` link |
| GPS shows ±100 m or more | Laptop Wi-Fi location | Use a phone outdoors, or a demo location |
| Report fails with *Something went wrong* | Usually Gemini's daily limit (`429` in the terminal) | Wait for the reset, or use a key with billing |
| Report takes over 30 s | Gemini response time (30–78 s seen) | Retry; on Vercel the limit is 60 s |
| Map shows a pin but no place name, or only the road type | The place-name lookup (OpenStreetMap Nominatim) was slow or unreachable; the form falls back to the pilot road data | Retry; check the terminal for `reverse geocode failed` |
| Repair always rejected from your desk | You are more than 15 m from the issue (correct) | Test approval on site (C2) |
| No confirm/dispute buttons | Issue isn't Fixed, or you aren't the citizen role | — |
| *issue already has an active work order* | One active work order per issue (by design) | Review or reject the current one first |
| supabase-js errors on start | Node 20 | `nvm use` (Node 24) |

**Database** (Supabase dashboard → SQL editor, or `psql "$DATABASE_URL"` with the URL from `web/.env.local`):

```sql
select id, issue_type, status, severity, road_name, report_count, created_at
  from issues order by id desc limit 10;
select id, issue_id, contractor_id, ngo_id, status, payment_status, deadline
  from work_orders order by id desc limit 10;
select id, work_order_id, verdict, officer_decision, round(distance_m) as m, verdict_reason_en
  from repair_proofs order by id desc limit 10;
select id, created_at, actor_role, action, entity, entity_id
  from audit_log order by id desc limit 20;
select * from verify_audit_chain();        -- first_broken_id should be null
select * from contractor_scorecards();
```

**Where the code is** (all under `web/`)

| Area | Files |
|---|---|
| Screens | `src/app/<role>/page.tsx` |
| Server actions per role | `src/app/<role>/actions.ts`, documented in `BACKEND_CONTRACT.md` |
| Citizen report pipeline | `src/lib/reports.ts` |
| Officer, contractor, feedback, payment | `src/lib/workflow.ts` |
| Approve / reject / officer rule for repairs | `src/lib/repair-verdict.ts` (+ tests) |
| Severity score and deadline bands | `src/lib/severity.ts` (+ tests) |
| Public tracker and update log | `src/lib/public-log.ts`, `src/lib/public-log-rules.ts` (+ tests) |
| AI calls and prompt | `src/lib/ai/` (Gemini vision, Groq primary text, GLM fallback) |
| Distances and GPS quality (15 m, 25 m, 500 m) | `src/lib/geo.ts` (+ tests) |
| Report form and location map | `src/components/citizen/report-form.tsx`, `location-map.tsx` |
| Schema, security, payment gate, audit chain | `supabase/migrations/` |
| Repair and severity rules (also the AI's policy source) | `data/policy/pilot-sla-policy.md` |

### Cleaning up test data

```sql
delete from issues where id = <ID>;   -- also removes its reports, work orders, repair proofs and feedback
```

- **Photos stay in Storage** (bucket `photos`, folders `reports/` and `repairs/<work order id>/`).
  List the leftovers, then delete them in the dashboard:

  ```sql
  select name from storage.objects o
   where bucket_id = 'photos'
     and not exists (select 1 from reports r where r.photo_path = o.name)
     and not exists (select 1 from repair_proofs p where p.photo_path = o.name);
  ```
- **The audit log keeps its entries.** That's by design: nobody can edit or delete it. The public
  log simply hides entries for deleted issues.
- **Leave issue #3** (an early test report) unless the team lead says otherwise.

## 6. Known issues and not built yet

### Known issues

1. **Work-site checkbox defeats the location check.** The contractor's *Use the work site
   location* option sends the issue's coordinates as if they were GPS, and nothing records it. A
   repair can pass the 15 m check from anywhere. A fix is proposed: record it, and send such
   repairs to the officer instead of auto-approving.
2. **Gemini free tier:** about 20 photo checks per day for the whole team.
3. **CSS edits** to `globals.css` need a dev-server restart. The likely cause is the Tailwind
   Turbopack loader; Next.js recommends the PostCSS setup instead.
4. **Gemini response time** sometimes exceeds the 60 s Vercel limit for a report.
   **Place names** come from OpenStreetMap's free public Nominatim service (max 1 request per
   second, light use only). Fine for the prototype; production needs its own geocoder.
5. **Thin line across the map** where two tiles meet, on some high-resolution screens. Cosmetic.
6. **No audit history in the officer's issue detail.** Overrides and decisions are visible on the
   Audit tab only.
7. **Face and number-plate blurring is not built.** The AI flags such photos, and the policy text
   and an issue-page note say they "will be blurred". The public portal shows no photos.
8. **The home page's Public portal card mentions before/after photos**, which the public portal
   does not show.
9. **The AI's policy search is out of date** after the privacy-rule wording change. Run
   `pnpm seed:policy` once (team lead).

### Not built yet (please don't report these as bugs)

- NGO "willing to help" action (NGOs can only see suitable issues and their assigned jobs).
- Ward boundaries: the officer's area filter and per-ward figures.
- Model card page; KPI measurements (requirements §8).
- Tap-to-adjust pin on the report map.
- Real contractor identity: **Viewing as** is a prototype shortcut, like the role switcher.

## 7. Reporting a bug

Open a GitHub issue on `Ir-Rafi/CivicTrust` with:

- role and language;
- device and browser;
- the page URL;
- steps to reproduce;
- expected vs actual result;
- the time it happened;
- issue and work order IDs;
- the error lines from the `pnpm dev` terminal;
- a screenshot.
