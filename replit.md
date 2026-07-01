# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Usage tracking

Measures value delivered (hours/dollars saved vs manual effort). Two-level model,
best-effort (a tracking failure never blocks the primary request):

1. **Local detail store** — every event is written to the `usage_events` table
   (richer than official impact: `source`, `entityType/entityId`, `detail` JSON,
   `forwardStatus/forwardError`). This is the portable substitute for the guide's
   JSONL fileshare (`\\enr-comos-fs\UsageLogFiles\`), which is Windows-only.
2. **Official impact API** — value-producing events are forwarded (HTTP GET) to
   the BMcD UsageTracking API, gated on the `USAGE_TRACKING_URL` env var, which is
   set in **production only** so dev/test never forwards. Params sent: `Program`,
   `Addin`, `Version`, `Usage`, `Username`, `TimeStamp` (UTC `yyyy-MM-dd HH:mm:ss.fff`),
   `UsageUnit`. Dollars are **not** sent — the dashboard/governance layer applies
   `Hours = TimeSaved × UsageUnit` and `Dollars = Hours × 85`. Our own Impact page
   computes hours/dollars locally for internal visibility only.

Catalog (single source of truth): `artifacts/api-server/src/lib/constants.ts`
(`USAGE_ACTIONS`). Helper: `artifacts/api-server/src/lib/usage.ts`. Only
value-producing completions are tracked (create request, generate email drafts,
schedule meeting, import tracker row) — never tool-started/debug/error events.

`usage` event names follow the governance pattern `<Platform>_<System>_<Tool>_<Action>`
and must stay stable once the dashboard governance table references them:

| Action | Usage name | UsageUnit | Time saved/unit |
| --- | --- | --- | --- |
| Create request | `Web_PWR_RiskCoordinator_CreateRequest` | 1 per request | 20 min |
| Generate email drafts | `Web_PWR_RiskCoordinator_GenerateEmailDrafts` | # drafts | 15 min |
| Schedule meeting | `Web_PWR_RiskCoordinator_ScheduleMeeting` | 1 per meeting | 10 min |
| Import tracker row | `Batch_PWR_RiskCoordinator_ImportTrackerRow` | 1 per row | 5 min |

**Governance intake TODO:** hand the usage names above to the dashboard owner, and
decide the optional `SettingGP` / `SettingDept` / `SettingClient` context values
(not currently sent — the guide marks them optional).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
