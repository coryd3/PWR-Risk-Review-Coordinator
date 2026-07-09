---
name: Email notifications design
description: How new-request email notifications work and constraints to preserve
---

- Email sending uses a Microsoft Graph service principal (client-credentials via plain fetch) configured entirely at runtime from the Admin console — no env-based provider config except optional APP_BASE_URL for links. **Why:** user declined Replit Outlook OAuth; app must stay portable to a company-hosted environment.
- The client secret is write-only through the API: responses only carry a `clientSecretSet` boolean, and audit details record field names only, never values. Preserve this on any future settings work.
- `email_settings` is a DB-enforced singleton: fixed primary key id=1 with atomic upsert (`onConflictDoUpdate`). Do not revert to select-then-insert — it creates duplicate rows under concurrency.
- Notification sending is fire-and-forget from request creation (`void notifyNewRequest(...)`), never awaited on the response path; failures log + write a `notification_failed` audit event via `recordAuditDirect` (system actor, no Express req).
- Calendar invites (send/update/cancel Outlook meetings) reuse the same Graph service-principal credentials, but the app registration additionally needs the **Calendars.ReadWrite application permission** (Mail.Send alone is not enough). Meeting times are stored as absolute instants and sent to Graph as UTC — Outlook renders per-attendee local time, so no per-meeting timezone plumbing is needed.
- **How to apply:** any new outbound email feature (e.g. auto-email to requester) should reuse the Graph adapter + settings row and follow the same non-blocking + audit pattern.
