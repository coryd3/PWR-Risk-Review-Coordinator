# PWR Risk Review Coordinator

An internal web app for the Burns & McDonnell PWR (Power) risk review team. It replaces the legacy **Microsoft Forms + Power Automate + Excel** workflow used to intake, coordinate, schedule, and track PWR risk review meetings.

A coordinator can:

- Intake and edit risk review **requests** (project info, contract values, business lines, risk triggers, EPC-prime flag, attendees by role, scheduling fields).
- See all requests on a **Dashboard** with summary cards and a filterable table.
- Auto-classify each request as **Major / Non-Major** and by **business line** (server-side rules).
- Track the **Pre-Risk → Formal Risk → Final Risk** stages via meetings and status history.
- Send, update, and cancel real **Outlook calendar invites** via Microsoft Graph (admin-configured, disabled by default), or download an `.ics` preview.
- Generate editable **email drafts** (six template types); new-request **notification emails** go to admin-managed subscribers.
- Manage users & roles, risk triggers, email templates, rules, email settings, and notification subscribers on an **Admin** page; measure time saved on an **Impact** page.

> Sign-in is required (OpenID Connect). Four roles — admin, contributor, viewer, requester — are enforced server-side, and every mutation is audited. The codebase stays portable for a Databricks App deployment (plain fetch, standard PostgreSQL, single-process production server).

## Tech stack

- **Monorepo:** pnpm workspace (`pnpm-workspace.yaml`).
- **Frontend:** React + Vite (`artifacts/risk-coordinator`), TanStack Query, generated typed API client.
- **Backend:** Express 5 (`artifacts/api-server`), all business logic isolated in `src/lib/` services.
- **Database:** PostgreSQL via Drizzle ORM (`lib/db`), accessed only through `DATABASE_URL`.
- **API contract:** OpenAPI (`lib/api-spec`) → generated Zod (`lib/api-zod`) + React Query hooks (`lib/api-client-react`).

## Project layout

```
artifacts/
  api-server/          Express API; serves built frontend in production
    src/lib/           rules, templates, calendar, auth, roles, audit, usage, notifications (all business logic)
    src/integrations/  graph/ (Microsoft Graph email + calendar), databricks client
    src/routes/        REST endpoints under /api (plus /login, /callback, /logout)
  risk-coordinator/    React + Vite frontend (Dashboard, New/Edit Request, Detail, Meetings, Admin)
lib/
  db/                  Drizzle schema, seed, migrations config
  api-spec/            OpenAPI spec + orval config
  api-zod/             Generated Zod schemas
  api-client-react/    Generated React Query hooks
db/
  schema.sql           Portable schema snapshot (pg_dump)
  migrations/          Drizzle-generated SQL migrations
scripts/
  import-tracker.ts    Legacy Excel/CSV risk-tracker importer (idempotent)
  fixtures/            Fake sample tracker for testing the importer
docs/                  Full documentation set (overview, requirements, architecture, data model, API, security, integrations, business rules, operations)
app.yaml               Databricks App start command
.env.example           Environment variable reference
```

## Running locally (Replit)

The Replit "Project" workflow starts the API server and the frontend dev server automatically. A PostgreSQL database is provisioned and `DATABASE_URL` is set for you.

To (re)initialize data:

```bash
pnpm run db:migrate   # apply the Drizzle schema to the database
pnpm run db:seed      # load 20 risk triggers, templates, rules, and sample requests
```

## Importing the legacy Excel tracker

`scripts/import-tracker.ts` migrates the team's old "risk review tracker"
spreadsheet (the legacy MS Forms + Power Automate + Excel workflow) into the
database so historical reviews are not lost. It accepts `.xlsx`, `.xls`, or
`.csv` files.

```bash
# Run the importer (run db:migrate and db:seed first so the 20 risk triggers exist):
pnpm run db:import scripts/fixtures/sample-tracker.csv

# Preview without writing anything:
pnpm run db:import scripts/fixtures/sample-tracker.csv --dry-run
```

What it does for each spreadsheet row:

- **Stages** the raw row verbatim into `imported_tracker_rows` (JSON + a content
  hash) for auditing.
- **Normalizes** it: money strings (`"$45,000,000"`) → numeric, business-line
  cells → array, the free-text risk-trigger column (numbers like `"1, 5"` or
  trigger names) → canonical `risk_triggers`, and per-role columns → `attendees`.
- **Creates** a `risk_review_request` plus its `request_risk_triggers`,
  `attendees`, and `meetings` (synthesized from the target dates present),
  running the same Major/Non-Major + business-line classification the API uses.
- **Reports** a summary — rows read, imported, skipped (with reasons), errors.
  Rows are never silently dropped; unmatched trigger text is appended to the
  request notes.

The importer is **idempotent**: re-running the same file skips rows already
imported (matched by content hash) and never creates a duplicate request for a
CRM opportunity number that already exists. Column headers are matched
case/spacing-insensitively with common aliases (e.g. `TIC` →
Total Installed Cost). It performs **no** email/Outlook/Graph calls — it only
reads the local file and writes to `DATABASE_URL`.

Header columns recognized (aliases accepted): Requester Name/Email, Client Name,
Project Name, CRM Opportunity Number, BMcD Contract Value, Total Installed Cost
(TIC), Business Line(s), Contract Review RVW #, EPC Prime, Request Type, Risk
Identification Status, the Pre-Risk/Formal Risk/Proposal/Formal Risk
Discussion/Final Risk dates, Pre-Risk Lead, Formal Risk Lead, Status, Next
Action, Owner, Risk Triggers, Notes, and one column per attendee role.

## Running with npm / pnpm scripts (portable)

Root `package.json` exposes the standard scripts (these also work via `npm run …`):

| Script              | What it does                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm run dev`      | Run the API server and frontend dev server together.                  |
| `pnpm run build`    | Typecheck, then build the frontend (base `/`) and the API server.     |
| `pnpm run start`    | Production: one Node process serving the API **and** the built frontend. |
| `pnpm run db:migrate` | Apply the Drizzle schema to the database (`DATABASE_URL`).           |
| `pnpm run db:seed`  | Seed triggers, templates, rules, and sample requests.                 |
| `pnpm run db:import <file>` | Import a legacy Excel/CSV risk tracker (idempotent). See above. |

Production startup order: `pnpm run build` then `pnpm run start`.

## Environment variables

See `.env.example`. Key ones:

- `DATABASE_URL` — PostgreSQL connection string (required).
- Port precedence at runtime: `DATABRICKS_APP_PORT` → `PORT` → `3000`. The server binds `0.0.0.0`.
- `NODE_ENV=production` makes the Express process also serve the built frontend.
- `BASE_PATH` — frontend base path (`/` for single-process deployment).

## Current scope notes

- The six coordinator email drafts are **not** sent automatically by design — the coordinator sends them from Outlook and marks them "Sent Manually". Only new-request notification emails and Outlook calendar invites are sent by the app (via Microsoft Graph, when configured and enabled by an admin).
- No free-busy/availability lookup when scheduling.
- Legacy Excel/CSV tracker import is available both in-app (Admin → Import, dry-run supported) and via CLI (`scripts/import-tracker.ts`).

## Documentation

The `docs/` folder is the complete technical and functional documentation set — see [docs/README.md](docs/README.md) for the index. Highlights:

- `docs/02-functional-requirements.md` — numbered requirements for every feature.
- `docs/04-data-model.md` — every table and column.
- `docs/05-api-reference.md` — every endpoint with roles and audit actions.
- `docs/06-security.md` — authentication, RBAC, audit, secrets, residual risks.
- `docs/07-integrations.md` — exactly what data enters and leaves the system.
- `docs/databricks-deployment-notes.md` — exact start command and go-live checklist.
