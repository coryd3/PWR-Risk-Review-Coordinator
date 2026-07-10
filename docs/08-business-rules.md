# 08 — Business Rules

All business logic lives in the API server
(`artifacts/api-server/src/lib/rules.ts`, `constants.ts`, `templates.ts`,
`calendar.ts`) so it is a single, testable source of truth and never
duplicated in React.

## 1. Major / Non-Major opportunity classification

`classifyMajor()` marks a request **Major** when any of the following holds:

| Condition | Threshold |
| --- | --- |
| Delivery method is Design-Build / EPC (or EPC-prime flag set) **and** BMcD contract value (fee) exceeds | **$10,000,000** |
| Delivery method is Professional Services **and** BMcD fee exceeds | **$10,000,000** |
| Delivery method is Design-Bid-Build **and** Total Installed Cost exceeds | **$50,000,000** |
| Any selected risk trigger is flagged `is_major_opportunity_trigger` (triggers 1 and 2 by default; the flag is admin-editable per trigger) | — |

Delivery-method detection (`classifyDelivery()`) is tolerant of label
variants (matches "epc", "design-build", "bid-build"/"dbb",
"professional" case-insensitively) plus the explicit EPC-prime flag.

## 2. Business-line classification

From the multi-select business lines (`classifyBusinessLine()`):

| Selection | Classification |
| --- | --- |
| BESS and Solar | `BESS + Solar` |
| BESS only | `BESS` |
| Solar only | `Solar` |
| GHI (with neither BESS nor Solar) | `GHI` |
| Anything else | `Other` |

Both classifications are stored on the request and recomputed on demand via
the classify action.

## 3. Attendee matrix

`computeAttendeeMatrix()` assembles the required/optional attendee roles and
distribution mailboxes for a request from the validated packet. Inputs:
request type (which meeting stages are needed), delivery method (EPC / DBB /
Professional Services), Major status, Total Installed Cost, and business
lines. Named default individuals are **configurable data on each rule, never
hardcoded into logic or templates** (packet requirement).

### Formal & Final Risk Reviews — required (all)

Formal Risk Coordinator; PWR Risk Coordinator; Executive-in-Charge;
Business-Line Director; Biz Develop/Capture Manager; Project Manager;
Engineering Manager; Attorney.

Additionally required for **EPC**: CDB Operations Executive; Business Line
CDB Operations Manager; Construction Manager (if applicable); Self-Perform
Construction Lead (if applicable).
Additionally required for **DBB**: Construction Manager (if applicable);
Self-Perform Construction Lead (if applicable).

### Formal & Final — optional

All: Regional GP Manager (if applicable); Regional Risk Manager (if
applicable); PWR Risk Admin (shared mailbox).
**Major only:** Senior VP & General Manager PWR; VP Operations; PWR Lead Risk
Coordinator; SVP Energy; COO Energy; Insurance.
**EPC/DBB only:** Senior VP of Self-Perform Construction (if applicable);
President of Construction (**only if EPC and TIC > $30M**); alternate CDB
Operations Executive seat (EPC only); Facility Security Director (EPC only).

### Pre-Risk Reviews

Required: Business-Line Director; Project Manager; Engineering Manager;
Construction Manager (if applicable). EPC/DBB additionally: CDB Operations
Manager; Self-Perform PM (if applicable).
Optional: Executive-in-Charge; Biz Develop/Capture Manager; Attorney;
Regional GP Manager / Regional Risk Manager (if applicable); PWR Lead Risk
Coordinator; PWR Risk Admin; Other Attendees.

### Distribution mailboxes

Business-line distribution mailboxes are appended to optional recipients when
business line and delivery method match (Solar/BESS × EPC-DBB vs non-EPC
variants).

### Rules of composition

- Roles are deduplicated with required seats winning over optional seats.
- Seats marked "if applicable" (conditional) are **not** flagged by
  missing-attendee warnings; only unconditional required seats are
  (`getRequiredRoles()`).
- Coordinator seats (Formal Risk Coordinator, PWR Risk Coordinator) are
  assigned by an admin after intake — never collected on the request form.
- Unnamed required seats display as `Placeholder "Role"` in the UI (meetings
  list and request detail) so every required seat stays visible until filled.

## 4. Validation warnings (non-blocking)

`computeWarnings()` — surfaced on the request detail page, never blocking a
save:

| Code | Condition |
| --- | --- |
| attorney_missing | No named Attorney attendee |
| rvw_missing | Contract Review RVW # blank |
| formal_risk_legal_incomplete | Formal Risk requested and legal info incomplete |
| legal_missing_explanation_required | Legal info missing and no explanation provided |
| final_risk_missing_formal_date | Final Risk requested without Formal Risk discussion date |
| risk_identification_status | Risk ID meeting status blank |
| risk_identification_no_explanation | Status "No" without explanation |
| risk_identification_date_missing | Status "Scheduled" without a date |
| risk_identification_other_explanation | Status "Other" without explanation |
| prerisk_after_formal | Pre-Risk target date after Formal Risk target |
| proposal_before_formal | Proposal due before Formal Risk target |
| required_attendees_missing | Unconditional required roles lacking a named person |
| no_triggers | No risk triggers selected |
| no_business_line | No business line selected |

## 5. Workflow status model

**Request statuses (15):** New; Needs Review; Missing Info; Roles Assigned;
Ready to Schedule Pre-Risk; Pre-Risk Scheduled; Pre-Risk Complete; Ready to
Schedule Formal Risk; Formal Risk Scheduled; Formal Risk Complete; Ready for
Final Risk; Final Risk Scheduled; Final Risk Complete; Cancelled; On Hold.

**Next actions (12):** Review request; Confirm attendees; Confirm legal
information; Confirm risk lead; Schedule pre-risk; Send pre-risk invite
manually; Await slides/risk register; Schedule formal risk; Send formal risk
invite manually; Follow up with requester; Schedule final risk; Close
request.

**Meeting statuses (11):** Not Started; Needs Scheduling; Scheduled;
Indicative; Waiting for Client; Not Needed; N/A; Complete; Rescheduled;
Cancelled; On Hold.

Every status change is appended to `status_history` and audited.

## 6. Email templates and drafts

Six template types (`{{placeholder}}` substitution, admin-editable):
Pre-Risk / Risk Review Request; Formal Risk Request; Final Risk Review
Request; Slides / Risk Register Reminder; Follow-Up Reminder; Reschedule
Notice.

Draft lifecycle: Draft → Reviewed → Ready to Send → Sent Manually /
Cancelled. Drafts are fully editable and are **not** sent by the app; the
coordinator sends them from Outlook and marks them Sent Manually (timestamped).
Every generated draft includes the risk review coordinator recipient, which is
configurable data (name + email), not hardcoded.

## 7. Calendar defaults

- Default duration **60 minutes**; default reminder **15 minutes**; default
  timezone label **America/Chicago**.
- Subject format: `PWR <Meeting Type> Review | <Client> - <Project> (<CRM #>)`.
- Organizer/From: the shared risk review mailbox (single configurable
  constant).
- Scheduled times are absolute instants stored in UTC; Outlook renders them
  in each attendee's local timezone.

## 8. Usage / impact catalog

| Action | Minutes saved per unit | Rationale |
| --- | --- | --- |
| Request intake | 20 | vs. manual form collation + tracker update |
| Email drafts generated | 15 | vs. writing each message by hand |
| Meeting scheduled | 10 | vs. manual coordination |
| Tracker row imported | 5 | vs. manual re-entry |

Dollars saved = hours × **$85/hour** burdened labor rate. `minutes_saved` is
frozen on each event at write time so later tuning of the catalog never
rewrites history. Usage identifiers follow the corporate governance naming
pattern `<Platform>_<System>_<Tool>_<Action>` and must remain stable.

## 9. Configurability boundaries

Editable at runtime by admins: risk triggers (incl. Major flag), rule sets,
email templates, email settings, notification subscribers, user roles.
Currently code-level constants (documented candidates for future admin
editing): status/action/meeting catalogs, attendee matrix defaults,
thresholds, usage catalog, labor rate.
