# PWR Risk Review Coordinator — Documentation

This folder is the complete technical and functional documentation set for the
PWR Risk Review Coordinator, written to support governance, security, and
architecture reviews as well as day-to-day operation and future development.

## How to read this set

| Document | Audience | Contents |
| --- | --- | --- |
| [01-overview.md](01-overview.md) | Everyone | What the system is, who uses it, roles, feature summary, glossary |
| [02-functional-requirements.md](02-functional-requirements.md) | Product / governance | Numbered functional requirements (FR-###) for every feature |
| [03-architecture.md](03-architecture.md) | Engineering / architecture review | Monorepo layout, technology stack, runtime topology, request lifecycle, API contract pipeline |
| [04-data-model.md](04-data-model.md) | Engineering / DBA / governance | Every table, every column, relationships, cascade behavior, seed data |
| [05-api-reference.md](05-api-reference.md) | Engineering / security review | Every HTTP endpoint with required role, request/response shape, error codes, and audit action |
| [06-security.md](06-security.md) | Security / governance review | Authentication, authorization, session management, secrets handling, audit logging, unauthenticated surface, known residual risks |
| [07-integrations.md](07-integrations.md) | Security / governance review | Microsoft Graph (email + calendar), notification fan-out, external usage-tracking forwarding, legacy tracker import — including exactly what data leaves the system |
| [08-business-rules.md](08-business-rules.md) | Product / coordinators | Major-opportunity classification, business-line classification, attendee matrix, validation warnings, email templates, status model |
| [09-operations.md](09-operations.md) | Ops / deployment | Build and start procedure, environment variables, database migration/seeding, logging, health checks, backup considerations |
| [databricks-deployment-notes.md](databricks-deployment-notes.md) | Ops | Databricks Apps–specific deployment notes (start command, port binding, Lakebase resource) |

## System snapshot

- **Purpose:** replaces the legacy MS Forms + Power Automate + Excel workflow
  for coordinating PWR risk review meetings (Pre-Risk, Formal Risk, Final Risk).
- **Stack:** TypeScript end-to-end. Express 5 REST API + React 18/Vite SPA in a
  pnpm monorepo; PostgreSQL via Drizzle ORM; OpenAPI-first API contract with
  generated Zod validators and a generated React Query client.
- **Authentication:** OpenID Connect (server-side session cookies); no
  unauthenticated access to business data.
- **Authorization:** four roles (admin, contributor, viewer, requester)
  enforced centrally on the server.
- **External calls:** Microsoft Graph (client-credentials; email + calendar,
  admin-configurable and disabled by default) and an optional usage-tracking
  forward (`USAGE_TRACKING_URL`). Nothing else leaves the system.
- **Audit:** every mutating API path writes an `audit_events` row.

## Documentation maintenance

These documents were generated from the codebase as of July 10, 2026, and are
expected to be updated alongside functional changes. Where a document states a
guarantee (for example, "the client secret is never returned by the API"), the
statement was verified against the source at time of writing; the source of
truth is always the code.
