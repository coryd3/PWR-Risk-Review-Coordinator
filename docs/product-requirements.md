# Product Requirements (as built)

The PWR Risk Review Coordinator replaces the legacy MS Forms + Power Automate + Excel workflow with a single web app a coordinator uses to intake, classify, coordinate, schedule, and track PWR risk review meetings.

## Personas

- **Coordinator (primary user):** creates and triages requests, confirms attendees and legal info, sets risk leads, generates email drafts and calendar previews, sends invites manually (outside the app for now), and tracks every request to completion.

## Screens

| Route             | Purpose                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `/`               | **Dashboard** — summary cards (New, Ready to Schedule, Pre-Risk Scheduled, Formal Risk Scheduled, Final Risk Scheduled, Missing Info, Completed) and a filterable/sortable request table. |
| `/requests/new`   | **New Request Form** — project info, contract values, business lines, risk triggers, EPC-prime flag, attendees by role, scheduling fields. |
| `/requests/:id`   | **Request Detail** — summary, triggers, Major/Non-Major + business-line classification, EPC status, attendees grouped by role, meetings, email drafts, calendar previews, notes, status history, validation warnings; actions to edit, re-classify, generate drafts, generate calendar preview, add notes, change status, add/update meetings. |
| `/requests/:id/edit` | **Edit Request** — same fields as intake.                                                    |
| `/meetings`       | **Meeting Tracker** — meetings across all requests with type, status, dates.                     |
| `/admin`          | **Admin / Config** — risk triggers, email templates, rule sets.                                  |

## Core capabilities

- **Intake & persistence:** every request is stored in PostgreSQL; nothing is hardcoded in React. Refreshing never loses data.
- **Classification (server-side):** Major/Non-Major and business line computed by the rules service and stored on the request.
- **Validation warnings (non-blocking):** ten checks surfaced on the detail page; they never block saving.
- **Stage tracking:** Pre-Risk / Formal Risk / Final Risk modeled as meetings, with status + status history.
- **Email drafts:** six template types rendered from `{{placeholder}}` templates; fully editable; statuses (Draft → Reviewed → Ready to Send → Sent Manually / Cancelled). **Never sent by the app.**
- **Calendar previews:** generated per meeting type with subject/body/attendees/start-end/timezone/Teams placeholder. **Preview only — no real event.**
- **Configuration:** risk triggers, templates, and rule sets are stored in the database and surfaced on Admin.

## Explicitly out of scope (MVP)

- Sending real emails; creating real Outlook events; Microsoft Graph / Teams calls; availability lookup. All stubbed and labeled "Future Integration".
- Authentication / user accounts. `owner` and change-author fields use placeholder coordinator values.
- Full Excel tracker import — stub script + documented design only (`scripts/import-tracker.ts`).
- Actual Databricks deployment — readiness only (see `databricks-deployment-notes.md`).

## Data realism

Seed data uses placeholder names, emails, and opportunity numbers only — no real company/employee/opportunity data.
