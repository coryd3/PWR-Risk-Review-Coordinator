# 02 — Functional Requirements

Numbered requirements describing the system as built. Each requirement is
implemented and verifiable in the current codebase unless explicitly marked
otherwise.

## FR-100 Request intake

- **FR-101** Users with role `requester`, `contributor`, or `admin` can submit
  a new risk review request via a web form.
- **FR-102** The form captures: requester name/email, client name, project
  name, CRM opportunity number, BMcD contract value (raw text + parsed
  numeric), Total Installed Cost (raw + numeric), business lines
  (multi-select: BESS, NES, GHI, Nuclear, Solar, Mining), delivery method
  (Design-Build / EPC, Design-Bid-Build, Professional Services), region (KC /
  Non-KC), EPC-prime flag, request type (Pre-Risk & Formal Risk Discussion, or
  Final Risk Review), Contract Review Request RVW #, legal-missing
  explanation, risk identification status (Yes / No / Scheduled / Other) with
  date/explanation, target dates (pre-risk, formal risk, final risk, proposal
  due, formal risk discussion), risk leads, notes, and attendees by role.
- **FR-103** The form pre-seeds required attendee seats from the server-driven
  attendee matrix (see 08-business-rules.md) based on request type and
  delivery method.
- **FR-104** Coordinator-assigned seats ("Formal Risk Coordinator", "PWR Risk
  Coordinator") are never collected on the intake form; admins fill them in
  later, which advances the request status.
- **FR-105** All request data is persisted in PostgreSQL; a page refresh never
  loses data.
- **FR-106** On creation the server classifies the request (FR-200), creates
  the meeting-stage records implied by the request type, records an audit
  event, records a usage event, and (when email is configured) notifies
  subscribers (FR-700).

## FR-200 Classification

- **FR-201** Major-opportunity classification is computed server-side:
  Design-Build/EPC or Professional Services with BMcD fee > $10M; or
  Design-Bid-Build with TIC > $50M; or any selected risk trigger flagged as a
  Major trigger (triggers 1 and 2 by default, admin-editable).
- **FR-202** Business-line classification is derived from the multi-select
  business lines (BESS + Solar, BESS, Solar, GHI, Other).
- **FR-203** Both classifications are stored on the request and can be
  recomputed on demand via a "classify" action, which is audited.

## FR-300 Validation warnings

- **FR-301** The request detail page shows non-blocking validation warnings.
  Warnings never prevent saving.
- **FR-302** Implemented warning checks: attorney missing; RVW # missing;
  Formal Risk requested with incomplete legal info; legal info missing without
  an explanation; Final Risk requested without a Formal Risk discussion date;
  risk identification status blank / "No" without explanation / "Scheduled"
  without a date / "Other" without explanation; pre-risk target after formal
  target; proposal due before formal target; required attendee roles missing
  (per the attendee matrix, unconditional seats only); no risk triggers
  selected; no business line selected.

## FR-400 Workflow status tracking

- **FR-401** Requests move through 15 statuses (New → … → Final Risk Complete,
  plus Cancelled and On Hold); the current status and a "next action" (from a
  12-value catalog) are stored on the request.
- **FR-402** Every status change appends an immutable `status_history` row
  (previous status, new status, author, timestamp, notes) and an audit event.
- **FR-403** Free-text notes can be added to a request; notes are
  append-only via the API and audited.

## FR-500 Meetings and calendar invites

- **FR-501** Each request carries meeting records for its stages (Pre-Risk,
  Formal Risk, Final Risk) with type, status (11-value catalog), target date,
  scheduled start/end (absolute instants, stored UTC), timezone label
  (default America/Chicago), subject, body, Teams link, Outlook event ID,
  risk lead, rescheduled count, and notes.
- **FR-502** A global Meetings page lists all meetings with project, schedule,
  attendees & stakeholders (required and optional, with placeholders for
  unnamed required seats), status, and invite state.
- **FR-503** Coordinators can send a real Outlook meeting invite for a
  scheduled meeting via Microsoft Graph. Preconditions enforced: email
  integration configured and enabled (else 409), scheduled start and end set
  (else 400), at least one attendee with an email (else 400).
- **FR-504** Re-sending updates the existing Outlook event (matched by stored
  event ID) instead of duplicating it. Cancelling cancels the Graph event
  (a 404 from Graph is treated as already-cancelled), sets meeting status to
  Cancelled, and clears the event ID. All invite operations are audited,
  including failures.
- **FR-505** When no Teams link is supplied, the invite is created as an
  online (Teams) meeting; a supplied link must be http(s) and is embedded
  instead.
- **FR-506** Independently of Graph, a calendar preview (.ics download,
  subject/body/attendees/times) can be generated for manual sending.

## FR-600 Email drafts and templates

- **FR-601** Six admin-editable templates ({{placeholder}} substitution):
  Pre-Risk / Risk Review Request, Formal Risk Request, Final Risk Review
  Request, Slides / Risk Register Reminder, Follow-Up Reminder, Reschedule
  Notice.
- **FR-602** Drafts are generated per request (optionally a subset of
  template types), fully editable (to/cc/from/subject/body), and carry a
  status: Draft → Reviewed → Ready to Send → Sent Manually / Cancelled.
  Generation and edits are audited.
- **FR-603** Drafts are not sent automatically by the app; "Sent Manually"
  records the timestamp. (Automated sending exists only for new-request
  notifications, FR-700.)

## FR-700 Notifications

- **FR-701** Admins maintain a list of notification subscribers (email, name,
  active flag).
- **FR-702** When a new request is created and the Microsoft Graph email
  integration is configured and enabled, all active subscribers receive an
  email with a summary table and a deep link to the request. Send outcomes
  are audited (system actor).
- **FR-703** Admins configure the integration in-app: tenant ID, client ID,
  client secret (write-only), sender address, and an enabled flag.

## FR-800 Administration

- **FR-801** Admins manage users: list, pre-add by email with a role, and
  change roles. Role changes take effect on the target's next request.
- **FR-802** Admins edit risk triggers (name, description, Major flag,
  active), rule sets, and email templates. All edits are audited.
- **FR-803** All reference catalogs (statuses, next actions, business lines,
  meeting types/statuses, delivery methods, regions, attendee roles, request
  types, draft statuses, template types) are served from `GET /config` as the
  single source of truth for the UI.

## FR-900 Legacy tracker import

- **FR-901** Admins upload the legacy Excel/CSV tracker. Rows are normalized,
  hashed for idempotency (re-importing the same row is a no-op), staged in
  `imported_tracker_rows`, and promoted into requests.
- **FR-902** A dry-run mode previews the import plan (create / skip /
  error per row) without writing.
- **FR-903** Import runs are audited and recorded as usage events.

## FR-1000 Usage tracking and impact

- **FR-1001** The system records usage events for: request created (20 min
  saved), email drafts generated (15 min), meeting scheduled (10 min), tracker
  row imported (5 min). Minutes-saved is frozen at write time.
- **FR-1002** An open `POST /usage` endpoint accepts raw usage events from
  external tools (mirroring the corporate UsageTracking contract).
- **FR-1003** When `USAGE_TRACKING_URL` is set (production), each event is
  forwarded fire-and-forget to the external tracker; per-event forward status
  (disabled/pending/sent/failed) is stored.
- **FR-1004** The Impact dashboard (admin) aggregates events into hours and
  dollars saved at a burdened labor rate of $85/hour.

## FR-1100 Authentication, authorization, audit

- **FR-1101** All business endpoints require an authenticated OIDC session;
  unauthenticated API calls receive 401. See 06-security.md.
- **FR-1102** Authorization is role-based and enforced centrally on the server
  for every request; the UI additionally hides actions the user cannot
  perform.
- **FR-1103** Every mutating business endpoint writes an audit event (entity
  type/id, action, actor, JSON detail, timestamp). Exception: `POST /usage`
  (telemetry intake) records an append-only `usage_events` row instead.

## Explicit non-requirements (current scope)

- No automated sending of the six draft email types (drafts are manual by
  design; only new-request notifications are sent automatically).
- No free-busy/availability lookup when scheduling.
- No delegated (on-behalf-of-user) Microsoft permissions; all Graph calls use
  an application service principal and a fixed sender mailbox.
- No public self-registration flow beyond OIDC sign-in with default
  `requester` role.
