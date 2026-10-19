# CivicTrust Pilot Service Policy

Authored by the CivicTrust team for the pilot. It is not an official city corporation regulation.
When a city partner signs on, their official maintenance rules replace this document in the knowledge base.

## Severity bands and repair deadlines

Every issue gets a severity score from 1 to 10. The repair deadline is set automatically when an officer assigns the job:

- Critical (severity 8 to 10): repair within 48 hours.
- High (severity 5 to 7): repair within 7 days.
- Medium (severity 3 to 4): repair within 14 days.
- Low (severity 1 to 2): repair within 30 days.

An officer may shorten a deadline but must record a reason. Lengthening a deadline requires a reason and is shown on the public portal.

## How the severity score is calculated

The score adds visible points so anyone can check it:

- What the photo shows: minor 2, moderate 4, severe 6 points (from the AI visual assessment, correctable by an officer).
- Road importance: primary or trunk road +2, secondary or tertiary road +1, other roads 0.
- Near a school or hospital: within 200 metres +1.5, within 500 metres +0.5.
- Citizen reports: +0.5 for each extra report, capped at +1 so busy or well-connected areas cannot outrank quieter ones.
- Days open: +0.1 per day, capped at +1.

The total is rounded and kept between 1 and 10.

## Issues near schools and hospitals

Severe potholes, open drains or waterlogging within 200 metres of a school or hospital are treated as public-safety risks. Officers should assign them on the same working day and consider temporary barriers or warning signs while the repair is pending.

## Duplicate reports

A new report within 25 metres of an open issue that shows the same problem is merged into the existing issue as an extra report instead of creating a new ticket. The citizen is told the issue is already reported and their report is counted.

## Repair verification before closing a job

A contractor's job closes only when all of these pass:

- The after-repair photo is taken in the app's camera, not uploaded from the gallery.
- The photo is taken within 15 metres of the original report location.
- The photo was captured within the last 30 minutes and after the work order was created.
- The AI compares the before and after photos and finds the same location with the problem resolved.

If any check fails, the job is rejected with the reason shown to the contractor and the officer. If the AI is unsure, the job goes to an officer for manual review instead of being rejected automatically.

## Citizen confirmation and disputes

After a job is marked fixed, the citizens who reported it can confirm or dispute the repair. A disputed repair reopens the issue for officer review and is counted on the contractor's scorecard.

## NGO and volunteer claims

Registered NGOs and volunteer groups may claim open issues to fix at no cost. An officer must approve the claim. NGO repairs pass the same verification checks as contractor repairs.

## Overdue jobs

A job past its deadline is marked overdue on the officer dashboard and counted against the contractor's on-time rate. Jobs overdue by more than 7 days are escalated to the ward's senior officer.

## Privacy

Photos are never shown on the public portal: only the reporting citizen, ward officers and the assigned crew see them. The AI flags photos in which faces or vehicle number plates are readable; automatic blurring is planned for the next phase. Photo location metadata is removed from stored files after the location is read. The public portal shows each issue by road name and nearest named school or hospital, with whether it is reported, assigned or fixed; exact locations are visible only to officers and assigned crews.

## Human oversight of AI

An officer can correct the AI's issue type or severity at any time. Every correction is recorded in the audit log with the officer, the old value, the new value and the reason.
