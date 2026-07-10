# 05 — API Reference

All business endpoints are mounted under `/api` and defined in
`lib/api-spec/openapi.yaml` (the authoritative contract; this document is the
governance-friendly summary). Request/response bodies are JSON validated with
generated Zod schemas.

## Conventions

- **Auth:** every endpoint below the "Public surface" section requires an
  authenticated session (401 otherwise) and a permitted role (403 otherwise).
  Roles: A = admin, C = contributor, V = viewer, R = requester.
  "V+" means viewer, contributor, or admin; "C+" means contributor or admin.
- **Audit:** the Audit column lists the `audit_events.action` value(s) written
  by the endpoint. `—` means read-only (no audit).
- **Errors:** 400 invalid input, 401 unauthenticated, 403 forbidden,
  404 not found, 409 precondition failed, 502 upstream (Microsoft Graph)
  failure. Error body: `{ "message": "..." }` (plus `error` on auth guards).

## Public surface (no session required)

| Method | Path | Purpose | Notes |
| --- | --- | --- | --- |
| GET | /healthz, /health | Liveness | `{ status: "ok" }`; no DB access |
| GET | /login | Start OIDC redirect (PKCE + state + nonce) | Sets short-lived httpOnly cookies |
| GET | /callback | OIDC redirect handler | Verifies state/nonce/PKCE; upserts user; creates session; sets `sid` cookie |
| GET | /logout | End session | Deletes server session, clears cookie |
| GET | /auth/user | Current user or null | Frontend auth probe |
| POST | /mobile-auth/token-exchange, /mobile-auth/logout | Mobile OIDC variants | Bearer-token session flow |
| POST | /api/usage | Record a usage event | **Intentionally open** — see 06-security.md §8 |

## Requests

| Method | Path | Role | Audit | Notes |
| --- | --- | --- | --- | --- |
| GET | /requests | V+ | — | List with computed fields |
| POST | /requests | A, C, R | `create` | Creates request + stage meetings + attendees; classifies; notifies subscribers; usage `request_created` |
| GET | /requests/:id | V+ | — | Detail: triggers, attendees, warnings, classification |
| PUT | /requests/:id | C+ | `update` | Partial update; strips undefined; 400 on empty body |
| DELETE | /requests/:id | A | `delete` | Cascades children |
| POST | /requests/:id/classify | C+ | `classify` | Recompute Major + business line |
| POST | /requests/:id/status | C+ | `status_change` | Appends status_history |
| GET | /requests/:id/status-history | V+ | — | |
| GET | /requests/:id/notes | V+ | — | |
| POST | /requests/:id/notes | C+ | `create` | |
| GET | /dashboard/summary | V+ | — | Pipeline counts |

## Meetings and invites

| Method | Path | Role | Audit | Notes |
| --- | --- | --- | --- | --- |
| GET | /meetings | V+ | — | All meetings joined with request info + required/optional attendee labels (unnamed required seats appear as `Placeholder "Role"`) |
| GET | /requests/:id/meetings | V+ | — | |
| POST | /requests/:id/meetings | C+ | `create` | Usage `meeting_scheduled` when scheduled |
| PUT | /meetings/:id | C+ | `update` | |
| POST | /meetings/:id/send-invite | C+ | `invite_sent` / `invite_updated` / `invite_failed` | 409 if email settings unconfigured/disabled; 400 if no scheduledStart/End or no attendee emails; 502 on Graph error. Create-or-update keyed by stored `outlookEventId` |
| POST | /meetings/:id/cancel-invite | C+ | `invite_cancelled` / `cancel_failed` | Graph cancel (404 treated as success); sets status Cancelled; clears event id |
| POST | /requests/:id/calendar-preview | C+ | — | Builds .ics-style preview; no external call |

## Email drafts

| Method | Path | Role | Audit | Notes |
| --- | --- | --- | --- | --- |
| GET | /requests/:id/email-drafts | V+ | — | |
| POST | /requests/:id/email-drafts/generate | C+ | `generate` | Renders templates (optionally a subset); usage `email_drafts_generated` |
| PUT | /email-drafts/:id | C+ | `update` / `sent_manually` | Marking Sent Manually stamps `sentAt` |

## Configuration and administration

| Method | Path | Role | Audit | Notes |
| --- | --- | --- | --- | --- |
| GET | /config | any authenticated | — | All catalogs/enums (needed by the new-request form, so requesters may read) |
| GET | /risk-triggers | any authenticated | — | Same reason |
| PUT | /risk-triggers/:id | A | `update` | |
| GET | /rule-sets | V+ | — | |
| PUT | /rule-sets/:id | A | `update` | |
| GET | /email-templates | V+ | — | |
| PUT | /email-templates/:id | A | `update` | |
| GET | /email-settings | A | — | Returns `clientSecretSet` boolean; **never the secret** |
| PUT | /email-settings | A | `update` | Secret is write-only; upserts singleton row id=1 |
| GET | /notification-subscribers | A | — | |
| POST | /notification-subscribers | A | `create` | |
| PUT | /notification-subscribers/:id | A | `update` | |
| DELETE | /notification-subscribers/:id | A | `delete` | |

## Users

| Method | Path | Role | Audit | Notes |
| --- | --- | --- | --- | --- |
| GET | /users | A | — | |
| POST | /users | A | `invited` | Pre-add by email with role; claimed at first sign-in |
| PATCH | /users/:id/role | A | `role_changed` | Effective on target's next request |

## Import and usage

| Method | Path | Role | Audit | Notes |
| --- | --- | --- | --- | --- |
| POST | /import/tracker | A | `import_tracker` | multipart upload (.xlsx/.csv); `dryRun` flag; idempotent by row hash; usage `tracker_imported` |
| GET | /usage | A | — | Raw events |
| GET | /usage/summary | A | — | Hours/dollars aggregates |
| POST | /usage | open | — | Raw external usage event; see 06-security.md §8 |

## RBAC rule table (server-enforced)

Authorization is a single ordered rule list in
`artifacts/api-server/src/lib/roles.ts`; first match wins:

1. `/users/**` (all methods) → admin
2. `POST /import/**` → admin
3. `GET /config`, `GET /risk-triggers/**` → all roles (requester included)
4. `GET /rule-sets|email-templates/**` → viewer+
5. Mutations on `/risk-triggers|rule-sets|email-templates/**` → admin
6. `POST /requests` → admin, contributor, requester
7. `/email-settings/**`, `/notification-subscribers/**` (all methods) → admin
8. `GET /usage/**` → admin
9. **Defaults:** any other GET → viewer+; any other mutation → contributor+

`OPTIONS` passes through (CORS preflight); `HEAD` is authorized as `GET`.
