# Rules, Validation, Templates, and Calendar Notes

All business logic lives in the backend (`artifacts/api-server/src/lib/`) so it stays out of React and is the single source of truth. Static enums are in `constants.ts`; classification/validation in `rules.ts`; rendering in `templates.ts`; calendar previews in `calendar.ts`.

## Major / Non-Major classification

A request is **Major** if any selected risk trigger is flagged `is_major_opportunity_trigger`, which is true for **Trigger 1 or Trigger 2**. Otherwise it is **Non-Major**. Computed by `classifyMajor()` and stored on the request.

## Business-line classification

From the multi-select business lines (`classifyBusinessLine()`):

| Selection                          | Classification |
| ---------------------------------- | -------------- |
| BESS **and** Solar                 | `BESS + Solar` |
| BESS only                          | `BESS`         |
| Solar only                         | `Solar`        |
| GHI, with neither BESS nor Solar   | `GHI`          |
| Any other combination              | `Other`        |

## Validation warnings (non-blocking)

`computeWarnings()` returns warnings that are shown on the detail page but **never block saving**:

1. Attorney is missing.
2. Contract Review Request RVW # is missing.
3. Formal Risk requested but legal information (attorney and/or RVW #) is incomplete.
4. Final Risk requested but Formal Risk Discussion Date is missing.
5. Risk Identification Meeting status is "No" or blank.
6. Pre-Risk target date is after Formal Risk target date.
7. Proposal due date is before Formal Risk target date.
8. Required attendees are missing (role set depends on EPC-prime; see below).
9. No risk triggers selected.
10. No business line selected.

### Required-attendee role sets

- **EPC-prime:** Business-Line Director, Project Manager, Attorney.
- **Non-EPC-prime:** Attorney.

The full attendee role taxonomy (EPC-prime vs. standard) lives in `constants.ts` (`EPC_PRIME_ROLES`, `STANDARD_ROLES`). The required-for-warning subset is intentionally small and is a future Admin-configurable rule.

## Email templates

Six template types, rendered with `{{placeholder}}` substitution by the template service:

1. Pre-Risk / Risk Review Request
2. Formal Risk Request
3. Final Risk Review Request
4. Slides / Risk Register Reminder
5. Follow-Up Reminder
6. Reschedule Notice

Generated drafts are fully editable (To/CC/Subject/Body) and carry a status: Draft → Reviewed → Ready to Send → Sent Manually / Cancelled. **The app never sends email** — drafts are copied/sent manually by the coordinator.

## Calendar previews

`calendar.ts` builds a preview (not a real event):

- Default duration: **60 minutes**.
- Default timezone: **America/Chicago** (Central).
- Default reminder: 15 minutes.
- Teams link is a **placeholder** string.
- Subject format: `PWR <Meeting Type> Review | <Client> - <Project> (<CRM Opportunity #>)`.
- Required/optional attendees are derived from the request's attendees.

No Outlook event, Microsoft Graph call, or Teams meeting is created. These are documented future integrations.

## Configurability

`constants.ts` currently holds the canonical enums (statuses, next actions, business lines, meeting types/statuses, roles, request types, draft/template types, calendar defaults). A future iteration can move these into the `rule_sets` / `email_templates` tables so they are editable from Admin without a code change.
