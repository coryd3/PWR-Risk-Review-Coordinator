---
name: Required attendee roles
description: How the app decides which attendee roles are mandatory (two separate code paths)
---

There are TWO distinct "required attendee" definitions. Do not conflate them.

## 1. Live app (request detail warnings) — the authoritative, dynamic one
`artifacts/api-server/src/lib/rules.ts`: `computeWarnings` -> `getRequiredRoles`
-> `computeAttendeeMatrix`, sourced from role lists in
`artifacts/api-server/src/lib/constants.ts`.

The required set is assembled PER REQUEST from a matrix, driven by:
- Review stage(s), derived from Request Type string: `requestNeedsPreRisk`
  (contains "pre-risk") and `requestNeedsFormalOrFinal` (contains "formal risk"
  or "final risk"). The two REQUEST_TYPES map to: "Pre-Risk & Formal Risk
  Discussion" => both stages; "Final Risk Review" => formal/final only.
- Delivery method via `classifyDelivery`: isEpc (Design-Build/EPC OR isEpcPrime
  flag), isDbb (Design-Bid-Build), isProfessionalServices. EPC/DBB add extra
  required seats.
- Major status and business line do NOT change the required set — they only add
  OPTIONAL attendees and business-line distribution mailboxes.

Only rules with `note == null` are flagged by the "Required attendees are
missing" warning. Conditional seats (note like "if applicable", "only if EPC
TIC > $30M") appear in the matrix but are intentionally NOT flagged.

"Populated" = `hasNamedAttendee`: an attendee row with that role AND a
non-empty trimmed name. Per-role, not per-row. (Attorney also has its own
standalone "Attorney is missing" warning, independent of the matrix.)

## 2. Legacy tracker importer — a flat fallback
`lib/tracker-import/src/tracker-normalize.ts`: `REQUIRED_ATTENDEE_ROLES` is a
fixed set of 6 (Business-Line Director, Project Manager, Engineering Manager,
Biz Develop/Capture Manager, Executive-in-Charge, Attorney), used by
`missingRequiredAttendeeRoles` to warn on imported spreadsheet rows. Flat, does
NOT vary by stage/delivery. `constants.ts` also exports a flat baseline
`REQUIRED_ATTENDEE_ROLES = FORMAL_FINAL_REQUIRED.map(r => r.role)` (8 roles).

**Why:** coordinators cannot run a review without the mandatory seats, so the
app warns (never blocks) when they are absent.

## Stale references resolved
The old `docs/rules-and-template-notes.md` (which described an outdated
EPC/Non-EPC role model) was deleted in July 2026; the docs suite
(`docs/08-business-rules.md`) now matches `rules.ts` + `constants.ts`.
Code remains the source of truth.
