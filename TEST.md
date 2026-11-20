# Testing and debugging guide

How to run the CivicTrust prototype, test everything built so far, and debug problems.
The acceptance criteria these tests follow are in
[`PRELIMINARY_PROTOTYPE_REQUIREMENTS.md`](PRELIMINARY_PROTOTYPE_REQUIREMENTS.md) (§7, AC1–AC10).

> **Before you start**
> - **Shared database.** Your local app talks to the same hosted Supabase database (Singapore) as
>   the team and both Vercel deployments. Everything you create is visible on the public portal. Clean up
>   test issues when you are done (see [Cleaning up](#cleaning-up-test-data)).
> - **Shared AI key pool.** The Gemini key pool is shared by the whole team and both deployments.
>   Each citizen report uses 1–3 photo checks; each repair check uses 1.
> - **Photograph only the problem.** Keep faces and number plates out of the frame; automatic blurring is on the roadmap.

## 1. Run it

Requirements: Node 24 (`nvm use` in the repo root reads `.nvmrc`), pnpm, and a `web/.env.local`
with the keys listed in `web/.env.example`.

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
    coordinates. The repair is recorded as "location not measured" and is never approved
    automatically: it is rejected or sent to the officer.

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
- [ ] **A2b Alternative manual location.** Choose **Choose the spot on the map yourself**.
  - With GPS unavailable or outside the pilot, the map opens on the dashed pilot area.
  - Tap inside the boundary or drag the pin: the chosen badge and Google Maps link update.
  - Tap outside the boundary: an error appears and the last valid pin is kept.
  - **Use my GPS location instead** restores the device fix. Manual mode does not submit
    the GPS location before a pin is selected. Pinned reports still require a fresh photo.
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
  - Filters: Open, Needs assignment, Critical (8+), Action needed, All, plus Type and Area. Areas
    are OpenStreetMap suburbs (e.g. Lalmatia) recorded when each issue is reported.
  - Change status, type and area together: chips, table and map update immediately without a
    server request. Area choices remain visible even when a type has no matching issues.
  - Browser Back/Forward restores the filters. Reloading a filtered URL preserves the same result.
  - Changing a filter clears the selected issue panel. Selecting a row opens it again;
    saving an officer action refreshes the queue and flags from the server.
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
- [ ] **B4 History.** Open any issue → **History (N)** at the bottom lists every step, oldest first:
  report, AI assessment, corrections with their reason, assignment, repair photos, reviews,
  citizen answers, payment. Bangla labels in Bangla mode.
- [ ] **B5 NGO offer.** NGO / volunteers → **Viewing as** *Demo Volunteer Group* → on an open
  garbage, drain or waterlogging issue press **We can help** → *Offer sent. The ward officer
  decides.* Then Ward officer → that issue → **Offers to help** lists the group; assign it to
  them with **Assign to → NGO / volunteers**. Once assigned, no new offers are accepted.
- [ ] **B6 Ask CivicTrust.** At the top of the officer page, press an example question or type one
  in English or Bangla → **Ask**.
  - The answer comes in the question's language, usually within 3–20 s, cites real issue IDs
    (#CT-N) or the policy section, and lists what it checked (e.g. *overdue repairs · issue timeline*).
  - Ask it to assign or approve something → it refuses and points to the queue; nothing changes.
  - The Audit tab shows `assistant_question` with the tools used.
- [ ] **B7 Overdue repairs.** A work order past its deadline without an approved repair shows a red
  **Past deadline** flag in the queue and appears under **Action needed**.
  - After the daily check runs (or `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/automation/overdue`),
    the public update log shows *Repair deadline passed without an approved repair*, once per work order.
  - `?dry_run=1` reports `to_record` without writing anything.

### C. Contractor repair and payment (AC7, AC8)

- [ ] **C1 Rejected repair (laptop).** Contractor → **Viewing as** *Demo Contractor A* → open the
  work order → **Take the after-photo** → leave the work-site box unticked →
  **Submit for AI verification**.
  - Expected: *Verification result: Rejected* with *The repair photo is N metres from the issue;
    the limit is 15 metres.*, and *Payment withheld*.
  - An old photo is rejected with *…older than the allowed verification window.*
  - With the work-site box **ticked**, even a convincing after-photo gives *Sent to officer* (or
    *Rejected*), never *Approved by AI*: *…The location was not measured (work-site demo option),
    so an officer must confirm the repair.*
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
  - **Reported problems:** type, road, area (e.g. *Road 16 · Lalmatia*), nearest landmark, and
    *Reported → Assigned → Fixed* with dates.
  - **Live updates:** each report, assignment, fix, dispute and confirmation appears. Rejected or
    unsure repair attempts do not.
  - Below: totals, money paid and withheld, contractor scorecards, and per-area figures, labelled
    *Areas come from OpenStreetMap until official ward boundaries are added.*
  - **Privacy:** no names, comments, coordinates or hash codes anywhere on the page.
- [ ] **E2 Scorecards.** A disputed or rejected job stays on the original contractor's card even
  after the issue is reassigned.
- [ ] **E3 Audit page.** *All records verified · N records checked. None has been altered or deleted.*
  Actions read as plain words (*Report submitted*, *Officer corrected the AI*, …).
  - As officer: a Hash column and real names.
  - As public or citizen: names show as *Citizen*, comments are hidden, and there is no Hash column.

### F. General

- [ ] **F1** Every screen in Bangla and English: Bangla digits, natural Bangla AI reasons.
- [ ] **F2** `/architecture`, `/data`, `/security`, `/model-card` and `/impact` load (all linked in the footer).
  The model card's thresholds and model names match the app (70% to auto-verify, 60% to merge or
  approve, 15 m, 30 minutes).
- [ ] **F3** Phone-width layout: nothing is cut off and there is no sideways scrolling.
- [ ] **F4** Open `/officer` while in the citizen role → you are asked to switch role.
- [ ] **F5** Maps survive navigation: open the officer queue (map) and the citizen report form
  (location map), go to another tab and come back. Both maps must show again. Cache Components
  keeps visited pages alive but hidden, and maps that don't handle that come back blank.
- [ ] **F6** Fallbacks:
  - When every configured Gemini model fails or none answers within 40 s, a citizen report shows *The AI
    is busy right now. Your report was not saved; please try again in a minute.* The terminal
    shows the reason (e.g. `429 RateLimitError`), and it is counted by `pnpm kpi`.
  - A repair whose location checks pass goes to the officer with *AI verification was unavailable*.

## 5. Debugging

**Where to look first**

- **Terminal running `pnpm dev`.** Server errors appear here, and browser console errors are
  forwarded as `[browser] …` lines. The same log is saved to `web/.next/dev/logs/next-development.log`.
- **`/api/health`** shows which keys are configured and whether the database answers.
- **`pnpm kpi`** prints the measurements from the live data: AI success and fallback rates,
  timings, duplicate merges and audit completeness. The **`/impact`** page shows the same figures
  on the site with sample sizes (`?since=YYYY-MM-DD` limits them to a test window).
- **`pnpm eval:photos <folder>`** measures accuracy on a labelled photo set (folder layout in the
  script header).
- **`pnpm smoke:ai`** tests the AI services without the UI.
- **A form says "Something went wrong"?** The real error is in the terminal.

**Common problems**

| Symptom | Cause | Fix |
|---|---|---|
| Page has no styling | Old stylesheet from a stale Next.js cache | Stop dev, `rm -rf web/.next`, start again, hard refresh (⌘⇧R) |
| Your CSS change doesn't show | Changes to `globals.css` apply after a restart ([operating note 3](#operating-notes)) | Restart `pnpm dev` |
| Page reloads endlessly (terminal fills with `GET /citizen` and *Suspense boundary* errors) | Tailwind scanning generated files (kept off by `source("..")` in `globals.css`), or a stale dev cache from before that fix | Stop `pnpm dev`, run `rm -rf web/.next/dev`, start again; close stale tabs |
| *Couldn't get GPS location* on a phone | `http://` LAN link | Use the ngrok `https://` link |
| GPS shows ±100 m or more | Laptop Wi-Fi location | Use a phone outdoors, or a demo location |
| Report says *The AI is busy right now* | Every Gemini model in the chain failed (`429` quota, `503` *high demand*) or none answered within 40 s | Wait and retry; add keys to `GEMINI_API_KEYS` or models to `GEMINI_VISION_FALLBACK_MODELS` (see `web/README.md`) |
| `/api/health` shows `"database": {"ok": false}` or *fetch failed* | The Supabase project is paused (free plan, about a week without activity) or the URL is wrong | Restore the project in the Supabase dashboard; check `SUPABASE_URL` |
| Your push isn't on the live site (Vercel says *Deployment was blocked*) | Vercel's free plan only deploys commits by the account owner | The owner redeploys (see [operating note 1](#operating-notes)) |
| Vercel build fails with a `next/font/google` error but `pnpm build` passes locally | Vercel's build machine | Build locally and upload with `vercel build` and `vercel deploy --prebuilt --prod` (see `web/README.md`) |
| Report takes over 20 s | Gemini is under heavy load; the backup models start 5 s apart (`GEMINI_HEDGE_MS`) | Retry later; `/api/health` shows the model order and number of keys |
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

## 6. Operating notes and roadmap

### Operating notes

1. **Deployments** come from the account owner's commits (Vercel Hobby plan with a private repo):
   other members' pushes show *Deployment was blocked* until the owner redeploys. When Vercel's
   build cannot download the Google font, deploying a local build with the CLI works.
2. **Gemini key pool:** calls are spread over keys from different projects, with backup models
   (see `web/README.md`), which absorbs per-key quotas and *high demand* spikes. A paid key raises
   the quota further.
3. **CSS changes** to `globals.css` apply after a dev-server restart (Tailwind Turbopack loader;
   Next.js recommends the PostCSS setup).
4. **Time budget:** a report finishes within 50 s, with a clear retry message if Gemini is slow,
   inside Vercel's 60 s limit.
   **Place names** come from OpenStreetMap's public Nominatim service (1 request per second), which
   suits the pilot; a city-wide rollout adds its own geocoder.
5. **Text providers:** Groq has answered every recorded explanation; GLM (`glm-4.7-flash`) is the
   automatic backup, and where `OLLAMA_BASE_URL` is set a local model (`qwen2.5:3b`) is tried last.
   A Bangla line containing letters from another script is filtered out, so only clean Bangla is shown.
6. **KPI history:** timing and AI-provider data are recorded from 19 Oct, and duplicate-comparison
   counts on merges from 21 Oct.
7. **Database uptime:** an UptimeRobot monitor keeps the Supabase database active (the free plan
   pauses after about a week without activity; see `web/README.md`).

### On the roadmap

- Official ward boundaries: OpenStreetMap areas are used until then.
- Face and number-plate blurring: the AI already flags such photos, and photos are never shown publicly.
- Field KPIs: `/impact` computes them live today; the city pilot adds real-use data
  (see `Docs/KPI_SUMMARY.md`).
- Contractor sign-in: **Viewing as** stands in for it, like the role switcher.

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
