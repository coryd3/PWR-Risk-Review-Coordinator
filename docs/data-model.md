# Data Model

PostgreSQL via Drizzle ORM. Schema lives in `lib/db/src/schema/` (barrel: `index.ts`). A portable snapshot is in `db/schema.sql`; generated migrations are in `db/migrations/`. All access is through `DATABASE_URL` in the backend data layer — never from the frontend.

## Tables (12)

| Table                   | Purpose                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `risk_review_requests`  | The core request: requester, client/project, CRM opportunity #, contract values (raw + numeric), business lines, EPC-prime flag, request type, risk identification status, target/discussion/proposal dates, risk leads, computed `is_major_opportunity` + `business_line_classification`, status, next action, owner. |
| `risk_triggers`         | The 20 canonical risk triggers (number, name, description, `is_major_opportunity_trigger`, active). |
| `request_risk_triggers` | Join between a request and its selected triggers (`request_id`, `trigger_id`). |
| `attendees`             | People on a request: name, email, `role`, `attendee_type`, `source`, `is_required`. |
| `meetings`              | Pre-Risk / Formal Risk / Final Risk meetings: type, target date, scheduled start/end, timezone, subject, body, Teams link, Outlook event id (always null in MVP), status, risk lead, rescheduled count, notes. |
| `email_templates`       | Six template types with subject/body containing `{{placeholders}}`.   |
| `email_drafts`          | Generated, editable drafts: template type, to/cc, subject, body, status, optional meeting link. |
| `rule_sets`             | Configurable rule definitions surfaced on Admin.                       |
| `status_history`        | Append-only record of status changes (from/to status, next action, author, timestamp). |
| `notes`                 | Free-text notes on a request (body, author, timestamp).               |
| `audit_events`          | Generic audit log of changes for traceability.                        |
| `imported_tracker_rows` | Staging table for the legacy Excel/CSV tracker import (`scripts/import-tracker.ts`): raw row JSON, content hash for idempotency, link to the created request, status/error. |

## Key relationships

- `risk_review_requests` 1—N `attendees`, `meetings`, `notes`, `status_history`, `email_drafts`, `request_risk_triggers`.
- `request_risk_triggers` N—1 `risk_triggers`.
- `email_drafts` optionally references a `meetings` row.

## Date/value handling notes

- Timestamp columns are returned as `Date` and serialized to ISO strings by the mappers; `date` columns are stored/returned as `YYYY-MM-DD` strings.
- Contract values are stored both raw (e.g. `"$45,000,000"`) and numeric for sorting/filtering.

## Regenerating the portable artifacts

```bash
pnpm --filter @workspace/db run generate   # writes SQL migration to db/migrations/
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > db/schema.sql
```
