# 09 — Operations, Deployment, and Environment

## 1. Environments

| Environment | Topology | Notes |
| --- | --- | --- |
| Development | Two processes: API server + Vite dev server | Replit workspace; `DATABASE_URL` provided by the platform |
| Production (target: Databricks Apps) | **Single Node process** serving API + built SPA | See `databricks-deployment-notes.md` for platform specifics |

## 2. Build and start

```bash
pnpm install            # pnpm-only monorepo (preinstall removes stray lockfiles)
pnpm run build          # typecheck + Vite build (BASE_PATH=/) + esbuild API bundle
pnpm run db:migrate     # apply schema to $DATABASE_URL (drizzle push)
pnpm run db:seed        # optional: reference data + sample requests
pnpm run start          # NODE_ENV=production node artifacts/api-server/dist/index.mjs
```

`app.yaml` (repo root) must contain exactly:

```yaml
command: ["corepack", "pnpm", "run", "start"]
```

plus the Lakebase (Databricks Postgres) resource binding. Do not modify the
command array — the deployment platform depends on this exact form.

## 3. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (Drizzle pool). Injected by Replit in dev and by the Lakebase resource on Databricks |
| `DATABRICKS_APP_PORT` | Platform | Port injected by Databricks Apps; takes precedence |
| `PORT` | Optional | Port fallback (default 3000). Precedence: `DATABRICKS_APP_PORT` > `PORT` > 3000; binds `0.0.0.0` |
| `NODE_ENV` | Optional | `production` enables static SPA serving from the API process |
| `FRONTEND_DIST` | Optional | Override path of built SPA assets (default `artifacts/risk-coordinator/dist/public`) |
| `BASE_PATH` | Build-time | Frontend base path; `/` for the single-process production build |
| `ISSUER_URL` | Optional | OIDC issuer (default `https://replit.com/oidc`); set to the corporate IdP for the target deployment |
| `REPL_ID` | Yes (auth) | OIDC client id used in discovery |
| `APP_BASE_URL` | Recommended in prod | Absolute base URL used for deep links in notification emails |
| `USAGE_TRACKING_URL` | Production-only | External UsageTracking API endpoint; unset = forwarding disabled |
| `ENABLE_OUTLOOK_INTEGRATION` | Optional | Feature toggle for Graph-dependent surfaces |
| `LOG_LEVEL` | Optional | pino level (default `info`) |

Microsoft Graph credentials (tenant ID, client ID, client secret, sender
mailbox) are **not** environment variables — they are entered by an admin in
the app (Admin → Email Notifications) and stored in the `email_settings`
row. See 06-security.md §5/§9 for handling guidance.

## 4. Database operations

- **Apply schema:** `pnpm run db:migrate` (Drizzle push against
  `DATABASE_URL`).
- **Seed:** `pnpm run db:seed` — reference data (20 triggers, 6 templates,
  rule sets) plus sample requests. For a production rollout, either skip the
  sample requests or delete them after verification; reference data is
  required.
- **Portable snapshot:** regenerate with
  `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > db/schema.sql`.
  Note: `drizzle-kit generate` is not usable in this project (known tooling
  issue) — use push + pg_dump.
- **Backups:** the application performs no backups itself; rely on the
  platform (Lakebase/managed Postgres) backup policy. Tables requiring
  retention attention for governance: `audit_events`, `status_history`,
  `usage_events` (all append-only).

## 5. First-run / bootstrap runbook

1. Deploy with a clean database; run migrate + seed.
2. **Have the intended system owner sign in first** — the first user to
   authenticate is auto-promoted to `admin` (see 06-security.md §9.8).
3. As admin: pre-add users with roles; configure Email Notifications (Azure
   AD app registration with application permissions `Mail.Send` and
   `Calendars.ReadWrite`, ideally scoped to the shared mailbox via an
   Exchange application access policy); add notification subscribers; enable
   the integration.
4. Optionally run the legacy tracker import (dry-run first).

## 6. Health, monitoring, and logs

- **Liveness:** `GET /healthz` (no DB access) for platform probes.
- **Logs:** structured JSON (pino) to stdout; the platform collects them.
  Warnings to watch: failed audit writes, failed usage forwards, Graph
  failures (also surfaced as 502s and audit rows).
- **Operational dashboards in-app:** Impact page (usage/forward status) and
  audit trail via the database.

## 7. Upgrades and change management

- API contract changes start in `lib/api-spec/openapi.yaml`; run
  `pnpm --filter @workspace/api-spec run codegen` and rebuild (contract drift
  is a compile error).
- Schema changes: edit `lib/db/src/schema/*`, run `db:migrate` (push), and
  refresh `db/schema.sql`.
- `pnpm run typecheck` and `pnpm run build` are the pre-deployment gates.
- Every mutation is audited, so post-change verification can be performed by
  inspecting `audit_events`.
