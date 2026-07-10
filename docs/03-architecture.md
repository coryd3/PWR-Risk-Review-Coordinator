# 03 — Technical Architecture

## Repository layout (pnpm monorepo)

```
/
├── app.yaml                      # Databricks Apps start command + Lakebase resource
├── package.json                  # Root scripts: dev, build, start, db:migrate, db:seed, typecheck
├── pnpm-workspace.yaml
├── db/
│   ├── schema.sql                # Portable pg_dump schema snapshot
│   └── migrations/               # Generated SQL migrations
├── docs/                         # This documentation set
├── artifacts/
│   ├── api-server/               # @workspace/api-server — Express 5 REST API
│   │   └── src/
│   │       ├── app.ts, index.ts  # App assembly and server bootstrap
│   │       ├── middlewares/      # authMiddleware (OIDC session resolution)
│   │       ├── routes/           # auth, requests, meetings, emailDrafts, config,
│   │       │                     # users, import, usage, health
│   │       ├── lib/              # auth (sessions), roles (RBAC), audit, usage,
│   │       │                     # rules, constants, templates, calendar,
│   │       │                     # notifications, requestService, mappers, logger
│   │       └── integrations/
│   │           ├── graph/        # graphEmailService, graphCalendarService (live)
│   │           ├── outlook/      # legacy stubs retained for reference
│   │           └── databricks/   # databricksClient
│   └── risk-coordinator/         # @workspace/risk-coordinator — React 18 + Vite SPA
│       └── src/pages/            # Dashboard, NewRequest, RequestDetail, EditRequest,
│                                 # Meetings, Admin, Impact, Import
├── lib/
│   ├── db/                       # @workspace/db — Drizzle ORM schema, client, seed
│   ├── api-spec/                 # @workspace/api-spec — openapi.yaml + orval codegen
│   ├── api-zod/                  # @workspace/api-zod — generated Zod schemas
│   ├── api-client-react/         # @workspace/api-client-react — generated React Query hooks
│   ├── replit-auth-web/          # OIDC web client hook (portable; plain fetch)
│   └── tracker-import/           # @workspace/tracker-import — normalize + plan legacy rows
└── scripts/                      # CLI import utilities
```

## Technology stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript (strict) everywhere |
| Backend | Node.js, Express 5, `openid-client` (OIDC), `pino` (logging), `multer` (file upload for import) |
| Frontend | React 18, Vite, wouter (routing), TanStack Query (data fetching), Tailwind CSS + shadcn/ui components |
| Database | PostgreSQL via Drizzle ORM (`DATABASE_URL`); node-postgres pool |
| API contract | OpenAPI 3 (`lib/api-spec/openapi.yaml`) → orval codegen → Zod validators (`@workspace/api-zod`) + typed React Query client (`@workspace/api-client-react`) |
| Outbound HTTP | Plain `fetch` only (portability requirement — no vendor SDKs) |

## Runtime topology

**Development:** two processes — the API server (Express) and the Vite dev
server for the SPA. The SPA proxies `/api` calls to the API server.

**Production (single process):** `pnpm run start` runs the bundled API server
(`artifacts/api-server/dist/index.mjs`), which:

1. Serves the REST API under `/api`.
2. Serves the built SPA static assets from `artifacts/risk-coordinator/dist/public`
   (overridable via `FRONTEND_DIST`), with an `index.html` fallback for
   non-`/api` GET routes (SPA client-side routing).
3. Binds `0.0.0.0` on `DATABRICKS_APP_PORT` > `PORT` > `3000`.

There are no background workers or cron jobs; all asynchronous work
(notification emails, usage forwarding) is fire-and-forget within the API
process and is resilient to failure.

## Request lifecycle (API)

```
Request
  → cors (credentials: true)
  → cookie parser / express.json()
  → public routers: /healthz, /login, /callback, /logout, /auth/user,
                    /mobile-auth/*, POST /api/usage
  → authMiddleware        — resolves session (sid cookie or Bearer token),
                            refreshes expired OIDC tokens, re-reads role from DB
  → authorizeByRole       — central RBAC guard (401 if unauthenticated,
                            403 if role not permitted for method+path)
  → business routers      — Zod-validate input, execute, write audit event,
                            optionally record usage event
  → JSON response
```

Key properties:

- **Central authorization.** A single rule table in `lib/roles.ts` maps
  method + path patterns to allowed roles; first match wins; defaults are
  GET → viewer-or-higher, mutation → contributor-or-higher. Route handlers do
  not implement their own role checks, eliminating drift.
- **Validation.** Request bodies are validated with generated Zod schemas
  derived from the OpenAPI spec; invalid input returns 400 with a message.
  Partial updates strip `undefined` keys and reject empty bodies (400) before
  reaching the database.
- **Error handling.** Errors are explicit: 400 (validation), 401
  (unauthenticated), 403 (forbidden), 404 (not found), 409 (precondition,
  e.g. email integration not configured), 502 (upstream Microsoft Graph
  failure). No silent fallbacks.

## API contract pipeline (OpenAPI-first)

1. Endpoints are defined in `lib/api-spec/openapi.yaml` (single source of
   truth, ~2,500 lines).
2. `pnpm --filter @workspace/api-spec run codegen` (orval) regenerates:
   - `@workspace/api-zod` — Zod schemas used by the server for input
     validation and response typing;
   - `@workspace/api-client-react` — typed React Query hooks and a small
     custom `fetch` wrapper (`custom-fetch.ts`) that surfaces server error
     messages (`ApiError` with `.data`).
3. The server and SPA both compile against the generated types, so contract
   drift is a compile-time error.

## Frontend architecture

- Pages under `src/pages/`, one route each (wouter). Base path comes from
  `import.meta.env.BASE_URL` so the app works both root-mounted (production)
  and path-mounted (development preview).
- All server state flows through the generated React Query hooks; mutations
  invalidate the relevant query keys.
- Auth state is provided by an `AuthProvider` wrapping `useAuth()` from
  `@workspace/replit-auth-web` (portable OIDC client: `GET /auth/user`,
  redirect to `/login`, `/logout`). A `can(permission)` helper gates UI
  affordances by role; the server remains the enforcement point.
- Toasts surface server-provided error messages
  (`err?.data?.message || err?.message`).

## Build pipeline

`pnpm run build` (root):

1. `pnpm run typecheck` — TypeScript project references for `lib/*`, then
   per-artifact typechecks.
2. Frontend build (Vite) with `BASE_PATH=/` → `artifacts/risk-coordinator/dist/public`.
3. API server bundle (esbuild) → `artifacts/api-server/dist/index.mjs`
   (single ESM file, source maps enabled at runtime).

## Logging

- `pino` structured JSON logs, level via `LOG_LEVEL` (default `info`).
- Failed audit/usage writes and failed external forwards are logged at `warn`
  and never crash the request.
- No secrets are logged; Graph tokens and client secrets are never written to
  logs.
