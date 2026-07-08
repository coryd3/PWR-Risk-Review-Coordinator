---
name: Outlook Option A (mailto + .ics) invites
description: Design decisions for the no-auth, no-server-call Outlook integration in risk-coordinator
---

Client-only Outlook integration (no OAuth, no server sends) lives in
`artifacts/risk-coordinator/src/lib/outlook.ts`: mailto links open pre-filled
drafts; downloadable `.ics` files open a ready-to-send meeting.

## Rules / decisions

- **Do NOT emit an `ORGANIZER` property in the `.ics`.**
  **Why:** Outlook desktop treats an imported invite whose ORGANIZER differs from
  the signed-in account as a *received* meeting — the user then cannot edit it or
  "Invite Attendees"/send, which breaks the "ready to send" promise. Omitting
  ORGANIZER makes the importing user the organizer.
  **How to apply:** keep the shared mailbox only in the DESCRIPTION text, never as
  an ORGANIZER line.

- **Attendees go in DESCRIPTION text, not as `ATTENDEE` lines.**
  **Why:** we only have attendee *names* (never emails); `ATTENDEE` requires a
  `mailto:` CAL-ADDRESS, and fabricating addresses produces bounce-prone invites.
  **How to apply:** list required/optional names in the description; the user adds
  real recipients in Outlook before sending. Pair with `METHOD:PUBLISH`.

- **Placeholder meeting start must be resolved in the review timezone
  (DEFAULT_TIMEZONE / America/Chicago), not the server's.**
  **Why:** the server runs in UTC (Replit + Databricks); parsing
  `new Date("${date}T10:00:00")` yields 10:00 UTC ≈ 4–5 AM Central, so a
  downloaded invite lands in the small hours. `buildCalendarPreview` uses a
  `zonedWallTimeToUtc` helper (Intl offset trick, DST-safe) so the emitted UTC
  instant is truly 10:00 AM local.
  **How to apply:** any placeholder/default time that becomes a real calendar
  event must be zone-resolved server-side, not left in server-local time.
