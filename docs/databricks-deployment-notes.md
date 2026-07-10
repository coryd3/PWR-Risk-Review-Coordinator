# Databricks Deployment Notes

Platform-specific notes for running the app as a Databricks App. The general
deployment/operations procedure lives in [09-operations.md](09-operations.md);
this file covers only the Databricks-specific contract. The codebase has no
Replit-only runtime dependencies: all data access goes through `DATABASE_URL`,
and all outbound calls use plain `fetch`.

## Exact start command

`app.yaml` at the repo root contains exactly:

```yaml
command: ["corepack", "pnpm", "run", "start"]
```

Do not change this array. It invokes the root `start` script, which runs a
**single Node process** serving both the REST API and the built React
frontend:

```
NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

`app.yaml` also declares the Lakebase (Databricks Postgres) resource that
injects `DATABASE_URL`.

## Build before start

The runtime expects the build to have already run:

```bash
pnpm install            # pnpm-only; never produces package-lock.json
pnpm run build          # typecheck + build frontend (base "/") + bundle API server
pnpm run db:migrate     # apply schema to the target PostgreSQL (DATABASE_URL)
pnpm run db:seed        # reference data (required); sample requests optional
pnpm run start          # production server
```

`pnpm run build` builds the frontend with `BASE_PATH=/` so assets are served
from the root, and bundles the API server to
`artifacts/api-server/dist/index.mjs`.

## Port binding

The server reads the port with this precedence and binds `0.0.0.0`:

```
const port = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 3000);
```

Databricks Apps inject `DATABRICKS_APP_PORT`; it takes precedence
automatically.

## Serving the frontend

When `NODE_ENV=production`, the Express app serves static files from
`artifacts/risk-coordinator/dist/public` (override with `FRONTEND_DIST`) and
falls back to `index.html` for non-`/api` GET routes (SPA routing). In
development the frontend runs as its own Vite server instead.

## Database

- PostgreSQL only, via `DATABASE_URL` (Lakebase resource). No key-value
  stores.
- Portable schema snapshot: `db/schema.sql` (from `pg_dump --schema-only`).
- Apply with `pnpm run db:migrate` (Drizzle push); seed with
  `pnpm run db:seed`.

## Authentication

The app uses OIDC (see [06-security.md](06-security.md)). For the Databricks
deployment, point `ISSUER_URL` at the corporate identity provider and supply
the OIDC client id via `REPL_ID`. The first user to sign in on a fresh
database becomes admin — follow the bootstrap runbook in 09-operations.md §5.

## Microsoft Graph integration

Implemented (not stubbed): notification email sending and Outlook calendar
invite create/update/cancel via an application service principal. Credentials
are entered by an admin in-app (Admin → Email Notifications), not via
environment variables. Required application permissions: `Mail.Send` and
`Calendars.ReadWrite`, ideally restricted to the shared mailbox with an
Exchange application access policy. Confirm outbound egress to
`login.microsoftonline.com` and `graph.microsoft.com` from the Databricks App
environment.

## Checklist before go-live

- [ ] `ISSUER_URL` / `REPL_ID` point at the corporate IdP.
- [ ] `APP_BASE_URL` set so email deep links resolve.
- [ ] `USAGE_TRACKING_URL` set (production-only) if impact forwarding is
      wanted.
- [ ] Intended owner performs the first sign-in (admin bootstrap).
- [ ] Graph app registration created, permissions consented, credentials
      entered in-app, test notification sent.
- [ ] Sample seed requests removed (keep reference data).
- [ ] Platform backup policy confirmed for the Postgres database
      (`audit_events`, `status_history`, `usage_events` retention).
- [ ] Adopt versioned migrations (currently Drizzle push) if required by
      change-management policy.
