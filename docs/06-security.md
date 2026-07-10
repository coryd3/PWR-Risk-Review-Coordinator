# 06 — Security and Access Control

This document describes the security architecture as implemented, with exact
mechanisms and file references, followed by the residual risks a governance
review should weigh.

## 1. Authentication (OIDC)

- **Protocol:** OpenID Connect Authorization Code flow with **PKCE**, `state`,
  and `nonce` (all verified on callback). Implemented with the standard
  `openid-client` library — no hand-rolled crypto.
- **Provider:** discovered from `ISSUER_URL` (default `https://replit.com/oidc`
  in the current environment; any standards-compliant OIDC issuer can be
  configured for the target deployment). Client ID comes from `REPL_ID`.
- **Flow files:** `artifacts/api-server/src/routes/auth.ts` (login/callback/
  logout), `src/lib/auth.ts` (session store), `src/middlewares/authMiddleware.ts`
  (per-request resolution).
- **Return-path safety:** the post-login redirect target is sanitized — only
  same-origin paths starting with a single `/` are honored (open-redirect
  protection).

## 2. Session management

- **Server-side sessions.** On successful callback the server creates a
  session row (`sessions` table) keyed by a **256-bit random hex id** and
  stores the OIDC profile plus access/refresh tokens in the `sess` jsonb
  column. The browser holds only the opaque `sid`.
- **Cookie flags:** `httpOnly: true`, `secure: true`, `sameSite: "lax"`,
  `path: "/"`. The interim OIDC cookies (code verifier, state, nonce,
  return-to) use the same flags with a short TTL.
- **TTL:** 7 days, refreshed on update; expired sessions are deleted on
  access. Logout deletes the server-side row and clears the cookie.
- **Token refresh:** expired OIDC access tokens are transparently refreshed
  via the refresh token; if refresh fails the session is destroyed (the user
  must re-authenticate) — never a silently degraded session.
- **API clients:** a session id may also be presented as
  `Authorization: Bearer <sid>` (used by the mobile-auth token-exchange flow).

## 3. Authorization (RBAC)

- **Four roles:** `admin`, `contributor`, `viewer`, `requester` (stored on the
  `users` row; validated at the API layer).
- **Central enforcement point:** `authorizeByRole` middleware runs after
  session resolution and before every business router. A single ordered rule
  table (`src/lib/roles.ts`) maps method + path to allowed roles; defaults are
  deny-by-role: GET requires viewer+, mutations require contributor+. Route
  handlers contain no ad-hoc role checks, so the policy cannot drift
  per-endpoint. The full table is reproduced in 05-api-reference.md.
- **No stale-privilege window:** the user's role is re-read from the database
  on **every request** (authMiddleware), so demotions/promotions apply
  immediately, not at next login.
- **Role assignment:** first-ever user → admin (bootstrap); everyone else →
  requester by default; admins may pre-add users by email with a role, which
  the user claims at first sign-in. Role changes are audited
  (`role_changed`).
- **UI gating is cosmetic only:** the SPA hides actions via a `can()` helper,
  but the server is the enforcement point; direct API calls receive
  401/403.

## 4. Unauthenticated (public) surface

The complete list of endpoints reachable without a session:

| Endpoint | Justification | Data exposure |
| --- | --- | --- |
| GET /healthz, /health | Platform liveness probes | Static `{status:"ok"}`; no DB access |
| GET /login, /callback, /logout | OIDC protocol requirements | None beyond the OIDC exchange |
| GET /auth/user | SPA auth probe | Returns `null` when unauthenticated |
| POST /mobile-auth/token-exchange, /mobile-auth/logout | Mobile OIDC variant | Requires a valid OIDC authorization code |
| POST /api/usage | Telemetry intake from external tools (Excel/Outlook add-ins, scripts) that have no browser session | Write-only; see §8 |

Everything else returns 401 without a valid session. `curl` against any
business endpoint without credentials demonstrably gets 401.

## 5. Secrets and sensitive data

| Secret | Storage | Handling |
| --- | --- | --- |
| Database credentials | `DATABASE_URL` environment variable | Never in code or logs; injected by the platform (Replit dev / Databricks Lakebase resource) |
| OIDC client identity | `REPL_ID` / `ISSUER_URL` env vars | Public identifiers (PKCE flow, no client secret required) |
| Microsoft Graph client secret | `email_settings.client_secret` column (admin-entered at runtime) | **Write-only via API**: `GET /email-settings` returns only `clientSecretSet: boolean`, never the value. Used server-side only to obtain tokens from `login.microsoftonline.com`. Not logged |
| OIDC access/refresh tokens | `sessions.sess` jsonb | Server-side only; never sent to the browser |
| Usage forward target | `USAGE_TRACKING_URL` env var | Production-only configuration |

Notable properties:

- No secrets are committed to the repository; `.env.example` contains
  placeholders only.
- Seed/sample data contains **no real personal or company data** (placeholder
  names and mailbox addresses only).
- The Graph client secret is at rest in the application database, not an
  external vault — flagged as a residual risk in §9.

## 6. Audit logging

- **Mechanism:** `recordAudit(req, …)` / `recordAuditDirect(…)`
  (`src/lib/audit.ts`) insert into the append-only `audit_events` table:
  entity type, entity id, action, actor, JSON detail, timestamp.
- **Actor resolution:** authenticated user's email, else user id, else an
  `x-actor`/`x-user-email` header (for system contexts), else null;
  background jobs record `"system"`.
- **Coverage:** every mutating business endpoint writes an audit event —
  including failed external operations (`invite_failed`, `cancel_failed`) and
  notification sends. The action-per-endpoint map is in 05-api-reference.md.
  The single exception is the telemetry intake endpoint `POST /api/usage`,
  which writes its own append-only `usage_events` row instead (it touches no
  business entities).
- **Failure behavior:** an audit-write failure is logged at `warn` and does
  not abort the business operation (availability over strict audit atomicity
  — see §9 for the governance trade-off).
- **No delete/update path:** the API exposes no endpoint that modifies or
  deletes audit events.

## 7. Input validation and injection resistance

- Business-endpoint request bodies are validated against generated Zod
  schemas (from the OpenAPI contract) before any database work; invalid input
  → 400. The telemetry endpoint (`POST /api/usage`) uses a manual normalizer
  (required-field checks, positive-integer coercion) rather than a generated
  schema.
- All SQL goes through Drizzle ORM parameterized queries; there is no string
  concatenation of SQL anywhere in the codebase.
- Partial updates strip `undefined` keys and reject empty bodies (400),
  preventing malformed no-op writes.
- Teams links supplied by users are restricted to `http`/`https` schemes
  before being embedded in Outlook invites (prevents `javascript:` and other
  scheme injection into calendar bodies).
- File import accepts only `.xlsx`/`.csv` uploads, parses them in-memory with
  a hardened normalizer, and stages rows before promotion; row hashing makes
  re-imports idempotent.
- React's default JSX escaping is relied on for output encoding; the app does
  not use `dangerouslySetInnerHTML` with user content.

## 8. The open usage endpoint (deliberate exception)

`POST /api/usage` accepts telemetry without authentication. This is a
deliberate product decision so that company tools without a browser session
(add-ins, batch scripts) can report usage.

Mitigations in place:

- **Write-only:** the endpoint cannot read anything; reads
  (`GET /usage`, `/usage/summary`) are admin-only.
- **Constrained shape:** input is validated; unit counts are normalized to
  positive integers; unknown catalog actions get zero default minutes unless
  explicitly supplied.
- **No privilege interaction:** rows carry `source: "external"` and touch no
  business entities.

Residual risk: an on-network actor could inflate impact metrics with junk
events. Impact dashboards are informational (not financial controls). If the
deployment environment requires it, a shared token check or network-level
allow-list can be added in front of this single route.

## 9. Residual risks and review notes

Honest list of items a security/governance review should evaluate:

1. **Graph client secret at rest in the DB.** Stored plaintext in
   `email_settings` (write-only via API, admin-only route). Acceptable only
   if database access is tightly controlled. Recommended hardening for the
   corporate deployment: move to the platform secret store (e.g. Databricks
   secrets) and keep only a reference in the DB, or encrypt the column with a
   KMS-held key.
2. **Audit best-effort semantics.** Audit writes never block the mutation, so
   a database partial failure could complete a mutation without its audit
   row (logged at `warn`). If strict atomicity is required, wrap mutation +
   audit in one transaction.
3. **Open usage endpoint** (§8) — metric-pollution risk only.
4. **CORS is permissive** (`origin: true` with credentials) in the current
   dev-oriented configuration. Cookie `SameSite=Lax` + the custom-header-free
   JSON API limits practical CSRF, but the production deployment should pin
   the allowed origin to the app's own domain (single-origin deployment makes
   this trivial).
5. **No rate limiting / lockout** at the application layer. The app expects
   to sit behind the platform ingress (Databricks Apps) — confirm
   platform-level throttling, or add express-rate-limit on the auth and
   import routes.
6. **Session revocation granularity.** Logout destroys the single session;
   there is no admin "kill all sessions for user X" endpoint. Role demotion,
   however, takes effect immediately (roles re-read per request), which
   covers the main privilege-revocation concern.
7. **Data sent to Microsoft Graph** (project names, attendee names/emails,
   meeting bodies) — inventoried precisely in 07-integrations.md; covered by
   the corporate Microsoft 365 tenancy.
8. **First-user-becomes-admin bootstrap.** Correct for a fresh internal
   deployment, but the deployment runbook must ensure the intended owner
   signs in first (see 09-operations.md).
