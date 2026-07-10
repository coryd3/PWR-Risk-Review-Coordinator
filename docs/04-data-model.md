# 04 — Data Model

PostgreSQL via Drizzle ORM. Schema source: `lib/db/src/schema/` (barrel:
`index.ts`). Portable snapshot: `db/schema.sql`; generated migrations:
`db/migrations/`. All access goes through the API server's data layer using
`DATABASE_URL` — the frontend never touches the database.

17 tables. Unless noted, primary keys are `serial id` and timestamps are
`timestamptz`.

## Core domain

### risk_review_requests — the central entity

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | serial PK | no | | |
| created_at / updated_at | timestamptz | no | now() | `updated_at` auto-set on update |
| requester_name / requester_email | text | yes | | Intake contact |
| client_name / project_name | text | yes | | |
| crm_opportunity_number | text | yes | | |
| bmcd_contract_value_raw / _numeric | text / double | yes | | Raw as typed (e.g. "$45,000,000") + parsed numeric for rules/sorting |
| total_installed_cost_raw / _numeric | text / double | yes | | Same pattern (TIC) |
| business_lines | text[] | no | [] | Multi-select: BESS, NES, GHI, Nuclear, Solar, Mining |
| business_line_classification | text | yes | | Computed (see 08) |
| contract_review_rvw_number | text | yes | | Legal RVW # |
| delivery_method | text | yes | | Design-Build / EPC, Design-Bid-Build, Professional Services |
| region | text | yes | | KC / Non-KC |
| legal_missing_explanation | text | yes | | Required (as a warning) when legal info missing |
| is_epc_prime | boolean | no | false | |
| is_major_opportunity | boolean | no | false | Computed (see 08) |
| request_type | text | yes | | "Pre-Risk & Formal Risk Discussion" or "Final Risk Review" |
| risk_identification_status | text | yes | | Yes / No / Scheduled / Other |
| risk_identification_date | date (string) | yes | | |
| risk_identification_explanation | text | yes | | |
| pre_risk_target_date, formal_risk_target_date, proposal_due_date, formal_risk_discussion_date, final_risk_target_date | date (string) | yes | | Stored/returned as YYYY-MM-DD |
| pre_risk_lead / formal_risk_lead | text | yes | | |
| status | text | no | 'New' | 15-value catalog (see 08) |
| next_action | text | yes | | 12-value catalog |
| owner | text | yes | | |
| notes | text | yes | | Intake-level notes (distinct from the notes table) |

### attendees

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | serial PK | no | | |
| request_id | int FK → risk_review_requests **ON DELETE CASCADE** | no | | |
| name | text | yes | | Null/blank = unfilled seat; required seats render as `Placeholder "Role"` |
| email | text | yes | | Used for Outlook invites |
| role | text | no | | Canonical role label from the attendee matrix |
| attendee_type | text | yes | | |
| source | text | yes | | e.g. seeded-by-matrix vs manually added |
| is_required | boolean | no | true | |

### meetings

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| id | serial PK | no | | |
| request_id | int FK → requests **CASCADE** | no | | |
| meeting_type | text | no | | Pre-Risk / Formal Risk / Final Risk |
| target_date | date (string) | yes | | |
| scheduled_start / scheduled_end | timestamptz | yes | | Absolute instants; sent to Graph as UTC; Outlook renders per-attendee local time |
| timezone | text | yes | 'America/Chicago' | Display label only |
| subject / body | text | yes | | Invite content |
| teams_link | text | yes | | If unset, invite is created as a Teams online meeting |
| outlook_event_id | text | yes | | Set when a Graph invite exists; cleared on cancel |
| status | text | no | 'Not Scheduled' | 11-value catalog (see 08) |
| risk_lead | text | yes | | |
| rescheduled_count | int | no | 0 | |
| notes | text | yes | | |

### risk_triggers / request_risk_triggers

- `risk_triggers`: `trigger_number` (int, not null), `trigger_name` (not
  null), `trigger_description`, `is_major_opportunity_trigger` (bool, default
  false — true for triggers 1 and 2 by default; admin-editable), `active`
  (default true). 20 canonical rows seeded.
- `request_risk_triggers`: join table; `request_id` and `trigger_id` both
  not null, both **ON DELETE CASCADE**.

### notes / status_history (append-only)

- `notes`: `request_id` FK **CASCADE**, `note_text` (not null), `created_by`,
  `created_at`.
- `status_history`: `request_id` FK **CASCADE**, `previous_status`,
  `new_status` (not null), `changed_by`, `changed_at` (default now), `notes`.

## Email and communications

### email_templates

`template_name`, `template_type` (six-value catalog), optional applicability
filters (`applies_to_major`, `applies_to_business_line`,
`applies_to_request_type`), `subject_template`, `body_template` (both not
null, `{{placeholder}}` syntax), `active` (default true). Six rows seeded.

### email_drafts

| Column | Notes |
| --- | --- |
| request_id | FK → requests **CASCADE**, not null |
| meeting_id / template_id / template_type | Optional provenance |
| to_recipients / cc_recipients / from_recipients | text, default '' |
| subject / body | text, default '' |
| status | default 'Draft'; catalog: Draft, Reviewed, Ready to Send, Sent Manually, Cancelled |
| created_at / updated_at / sent_at | timestamps; `sent_at` set when marked Sent Manually |

### email_settings (singleton; sensitive)

Single row with fixed `id = 1` (all writes upsert that row).

| Column | Notes |
| --- | --- |
| enabled | boolean, default false — master switch for all Graph sends |
| tenant_id / client_id | Azure AD app registration identifiers |
| client_secret | **Write-only through the API**: stored here, never returned to clients (reads expose only `clientSecretSet: boolean`). Stored at rest in the application database — see 06-security.md for handling guidance |
| sender_address | Mailbox used as From/organizer for all sends |
| updated_at | auto |

### notification_subscribers

`email` (not null), `name`, `active` (default true), `created_at`. Active
rows receive new-request notification emails.

## Identity and audit

### users

| Column | Notes |
| --- | --- |
| id | varchar PK, default `gen_random_uuid()` — OIDC subject for signed-in users |
| email | varchar, **unique** |
| first_name / last_name / profile_image_url | From the OIDC profile |
| role | varchar, not null, default 'requester'; values: admin, contributor, viewer, requester (validated at API layer; plain string for portability) |
| last_login_at | Null until first sign-in; pre-added ("invited") users have null until they claim the record |
| created_at / updated_at | auto |

### sessions

Server-side session store: `sid` (varchar PK, 256-bit random hex), `sess`
(jsonb — user profile, access/refresh tokens, expiry), `expire` (timestamp,
indexed). 7-day TTL; expired rows deleted on access.

### audit_events (append-only)

`entity_type` (not null), `entity_id`, `action` (not null), `actor` (email /
user id / 'system'), `detail` (JSON string), `created_at`. Written by every
mutating endpoint; see 05-api-reference.md for the action-per-endpoint map.

## Import and telemetry

### imported_tracker_rows

Staging for the legacy Excel/CSV tracker import: `source_file`, `row_number`,
`row_hash` (not null, **unique** — idempotency key), `source_row` (raw JSON,
not null), `request_id` FK → requests **ON DELETE SET NULL**, `status`
(default 'pending'), `error`, `imported_at`, `processed` (default false).

### usage_events

`program`/`usage`/`action` (not null), `addin`, `version`, `username`,
`usage_unit` (default 1), `minutes_per_unit` (default 0), `minutes_saved`
(default 0 — **frozen at write time** so later catalog changes do not rewrite
history), `entity_type`/`entity_id`, `source` (default 'app'; 'external' for
open-endpoint submissions), `forward_status` (disabled | pending | sent |
failed), `forward_error`, `detail`, `created_at`.

## Relationship summary

- `risk_review_requests` 1—N: attendees, meetings, notes, status_history,
  email_drafts, request_risk_triggers (all CASCADE on request delete);
  imported_tracker_rows references requests with SET NULL.
- `request_risk_triggers` N—1 `risk_triggers` (CASCADE).
- `email_drafts` optionally references a meeting/template by id (no FK
  constraint).
- `users`/`sessions`/`audit_events`/`usage_events`/`email_settings`/
  `notification_subscribers`/`rule_sets`/`email_templates` are standalone.

## Seed data (`lib/db/src/seed.ts`)

- 20 canonical risk triggers; 6 email templates; rule sets for Major and
  business-line classification.
- 7 sample requests ("Project Alpha" … "Eta") with attendees and meetings in
  varied workflow states. **Sample data uses placeholder names/emails only —
  no real company, employee, or opportunity data.**

## Migration strategy

- `pnpm run db:migrate` runs Drizzle **push** (schema sync) against
  `DATABASE_URL`.
- `drizzle-kit generate` is not usable in this project (known tooling issue);
  the portable snapshot is maintained with
  `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > db/schema.sql`.
- A production rollout should adopt versioned migration application; see
  09-operations.md.
