# 01 — System Overview

## Purpose

The PWR Risk Review Coordinator is an internal web application that manages the
end-to-end lifecycle of PWR risk review requests: intake, automatic
classification, attendee coordination, meeting scheduling (including real
Outlook calendar invites), standardized email drafting, notifications, status
tracking, legacy-tracker import, and value ("impact") measurement.

It replaces a manual workflow built on Microsoft Forms, Power Automate, and a
shared Excel tracker.

## Primary workflow

1. A **requester** submits a new risk review request (project details, contract
   values, business lines, delivery method, risk triggers, attendees).
2. The server **classifies** the request (Major / Non-Major opportunity;
   business-line classification) using centralized rules, and derives the
   required/optional attendee matrix.
3. Active **notification subscribers** receive an email summarizing the new
   request (when the Microsoft Graph integration is configured and enabled).
4. A **coordinator** (admin/contributor) triages the request: confirms
   attendees and legal information, assigns coordinator seats, resolves
   validation warnings, and advances the workflow status.
5. Meetings (**Pre-Risk**, **Formal Risk**, **Final Risk**) are created and
   scheduled. Outlook invites can be sent, updated, and cancelled directly from
   the app via Microsoft Graph, or an `.ics` preview can be downloaded for
   manual sending.
6. **Email drafts** for the six standard communication types are generated from
   admin-editable templates, edited, and marked sent.
7. Every step is recorded: status history, notes, audit events, and usage
   events (time-saved metrics shown on the Impact dashboard).

## User roles

| Role | Intended user | Capabilities (summary) |
| --- | --- | --- |
| `admin` | System owner / lead coordinator | Everything: user and role management, configuration (risk triggers, rule sets, email templates, email settings, notification subscribers), tracker import, impact dashboards, plus all contributor abilities |
| `contributor` | Risk review coordinator | Read everything (except admin-only areas); create/edit requests, meetings, notes, drafts; change statuses; send/cancel Outlook invites |
| `viewer` | Stakeholder / observer | Read-only access to requests, meetings, dashboards |
| `requester` | Project team member submitting a request | Submit new requests (and read the two catalogs the form needs: config enums and risk triggers). No other access |

Role assignment rules:

- The **first user ever to sign in** becomes `admin` automatically.
- Every subsequent new sign-in defaults to `requester`.
- Admins can pre-add users by email with a chosen role; when that person first
  signs in they claim the pre-added record and its role.
- Roles are re-read from the database **on every request**, so a role change
  takes effect immediately (there is no stale-session privilege window).

## Screens

| Route | Screen | Purpose |
| --- | --- | --- |
| `/` | Dashboard | Pipeline summary cards and a filterable, sortable request table |
| `/requests/new` | New Request | Intake form; pre-seeds required attendee seats from the attendee matrix |
| `/requests/:id` | Request Detail | Full workspace: summary, classification, triggers, warnings, attendees & stakeholders, meetings (with invite send/update/cancel), email drafts, calendar preview, notes, status history |
| `/requests/:id/edit` | Edit Request | Edit all intake fields, triggers, attendees |
| `/meetings` | Meetings | All meetings across requests with attendees & stakeholders, invite status, and send/update/cancel invite actions |
| `/admin` | Admin | User & role management; risk triggers, rule sets, email templates; Microsoft Graph email settings; notification subscribers |
| `/impact` | Impact | Usage metrics: actions tracked, hours and dollars saved (admin only) |
| `/import` | Import | Legacy Excel/CSV tracker import with dry-run preview (admin only) |

## Key design principles

- **Server-side source of truth.** All business rules (classification,
  attendee matrix, validation, templates) live in the API server, never in
  React components.
- **Portability.** No Replit-specific runtime dependencies: plain `fetch` for
  outbound calls, standard PostgreSQL via `DATABASE_URL`, single-process
  production server, `app.yaml` targeting Databricks Apps.
- **Auditability.** Every mutating business endpoint records an audit event
  with actor, action, entity, and detail (the telemetry intake endpoint logs
  to its own append-only table instead).
- **Fail-open telemetry, fail-safe business logic.** Audit/usage writes never
  block the primary operation; external email/calendar failures surface as
  explicit errors (HTTP 502) rather than silent fallbacks.
- **No emojis** anywhere in the product UI or generated communications
  (corporate style requirement).

## Glossary

| Term | Meaning |
| --- | --- |
| PWR | Power (business unit) — the organization running risk reviews |
| BMcD | Burns & McDonnell |
| Risk trigger | One of 20 canonical conditions (e.g., delivery method is Design-Build) that flag a project for risk review; triggers 1 and 2 force Major classification |
| Major opportunity | A request meeting fee/TIC thresholds or a Major-flagged trigger; expands the attendee matrix |
| TIC | Total Installed Cost |
| Delivery method | Design-Build / EPC, Design-Bid-Build (DBB), or Professional Services |
| Pre-Risk / Formal Risk / Final Risk | The three meeting stages of a risk review |
| RVW # | Contract Review Request number (legal tracking ID) |
| Attendee matrix | The rule-driven set of required/optional attendee roles per request, based on meeting stage, delivery method, Major status, and business line |
| First-Order Impact | Direct time saved by the tool, measured in minutes per tracked action and converted to dollars at a burdened labor rate |
