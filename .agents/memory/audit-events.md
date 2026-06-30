---
name: Audit events requirement
description: Every mutating API path must write an audit_events row
---

The `audit_events` table existing in the schema is not enough — an acceptance
review fails if no handler writes to it. Acceptance criteria for this app require
recording status-history and audit events on changes.

**Rule:** Every mutating endpoint (create/update/delete/classify/status-change/
note/draft generate+update/config edits) must call the `recordAudit()` helper.

**Why:** A prior review rejected the build because `auditEventsTable` had zero
source usages despite the table + migration existing.

**How to apply:** Helper is `artifacts/api-server/src/lib/audit.ts`
(`recordAudit(req, {entityType, entityId, action, actor?, detail?})`). It resolves
actor from an explicit value or the `x-actor`/`x-user-email` header, JSON-serializes
detail, and swallows insert failures (warn log) so audit never breaks the primary
request. When adding a new mutating route, add a recordAudit call before sending the
response.
