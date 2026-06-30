# Databricks Deployment Notes (readiness only)

The MVP is **not** deployed to Databricks. This document records how the codebase is kept portable so it can later run as a Databricks App wired to Outlook/Microsoft Graph. No Replit-only dependencies are used as a primary store; all data access goes through `DATABASE_URL`.

## Exact start command

`app.yaml` at the repo root contains exactly:

```yaml
command: ["corepack", "pnpm", "run", "start"]
```

This invokes the root `start` script, which runs a **single Node process** that serves both the REST API and the built React frontend:

```
NODE_ENV=production node --enable-source-maps artifacts/api-server/dist/index.mjs
```

## Build before start

The runtime expects the build to have already run:

```bash
pnpm install            # pnpm-only; never produces package-lock.json
pnpm run build          # typecheck + build frontend (base "/") + bundle API server
pnpm run db:migrate     # apply schema to the target PostgreSQL (DATABASE_URL)
pnpm run db:seed        # optional: load reference + sample data
pnpm run start          # production server
```

`pnpm run build` builds the frontend with `BASE_PATH=/` so assets are served from the root, and bundles the API server to `artifacts/api-server/dist/index.mjs`.

## Port binding

The server reads the port with this precedence and binds `0.0.0.0`:

```
const port = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 3000);
app.listen(port, "0.0.0.0", ...)
```

Databricks Apps inject `DATABRICKS_APP_PORT`; that takes precedence automatically.

## Serving the frontend

When `NODE_ENV=production`, the Express app serves static files from `artifacts/risk-coordinator/dist/public` (override with `FRONTEND_DIST`) and falls back to `index.html` for non-`/api` GET routes (SPA routing). In development the frontend runs as its own Vite server instead.

## Database

- PostgreSQL only, via `DATABASE_URL`. No Replit key-value Database.
- Portable schema snapshot: `db/schema.sql` (from `pg_dump --schema-only`).
- Generated migrations: `db/migrations/` (Drizzle).
- Apply with `pnpm run db:migrate`; seed with `pnpm run db:seed`.

## Required root files (present)

`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `app.yaml`, `.env.example`, `README.md`, `docs/`, `db/schema.sql`, `db/migrations/`.

## Future integrations to wire up

- **Outlook / Microsoft Graph:** `artifacts/api-server/src/integrations/outlook/` (`outlookClient`, `calendarService`, `emailService`) currently throw "Not implemented in MVP". Replace with Graph calls (send mail, create calendar events, real Teams links) and supply `OUTLOOK_*` credentials.
- **Excel tracker import:** implement `scripts/import-tracker.ts` (currently a documented stub) to backfill from the legacy tracker into `imported_tracker_rows` and then into requests.

## Risks before a real Databricks deployment

- Secrets management for Graph/Outlook credentials must be provided by the Databricks App environment.
- `db:migrate` uses Drizzle `push` (schema sync) for the MVP; a production rollout should adopt versioned migration application from `db/migrations/`.
- The frontend must be rebuilt with `BASE_PATH` matching the deployment mount path (use `/` for a root-mounted single-process app).
- Confirm outbound network egress and auth model before enabling any real email/calendar integration.
