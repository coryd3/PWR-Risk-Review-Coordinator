# 07 — External Integrations

Complete inventory of every path by which data enters or leaves the system.
There are exactly four: Microsoft Graph (outbound email), Microsoft Graph
(outbound calendar), the external usage tracker (outbound telemetry), and the
legacy tracker import (inbound file upload). Everything else is internal.

## 1. Microsoft Graph — shared plumbing

- **Code:** `artifacts/api-server/src/integrations/graph/`
  (`graphEmailService.ts`, `graphCalendarService.ts`); plain `fetch`, no SDK
  (portability requirement).
- **Auth model:** OAuth2 **client-credentials** flow (application service
  principal). `getGraphAccessToken` posts to
  `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token` with the
  admin-configured tenant ID, client ID, and client secret, scope
  `https://graph.microsoft.com/.default`.
- **Configuration:** entirely runtime/admin-managed via the singleton
  `email_settings` row (see 04-data-model.md): `enabled` master switch,
  tenant/client IDs, write-only client secret, sender mailbox. When
  unconfigured or disabled, every Graph-dependent endpoint returns 409 with a
  clear message — no silent skips.
- **Required application permissions on the Azure AD app registration:**
  - `Mail.Send` — send notification emails as the sender mailbox.
  - `Calendars.ReadWrite` — create/update/cancel events in the sender
    mailbox's calendar.
  Tenant admins should scope these with an Exchange **application access
  policy** restricting the app to the single shared mailbox.
- **Failure handling:** Graph errors surface as HTTP 502 to the caller and
  are audited (`invite_failed`, `cancel_failed`, failed notification sends);
  no retries beyond the immediate call.

## 2. Outbound email (new-request notifications)

- **Trigger:** creation of a risk review request (`notifyNewRequest` in
  `src/lib/notifications.ts`), fire-and-forget after the request is saved.
- **Recipients:** all `active` rows in `notification_subscribers`
  (admin-managed).
- **Data transmitted to Graph:** recipient addresses; subject; HTML body
  containing a summary table of the request (project, client, requester,
  values, classification, triggers) and a deep link built from
  `APP_BASE_URL`.
- **Sender:** the configured `sender_address` via
  `POST /users/{sender}/sendMail`.
- **Audit:** each send outcome recorded with actor `system`.

## 3. Outbound calendar (meeting invites)

- **Trigger:** explicit coordinator action only (`POST
  /meetings/:id/send-invite` / `cancel-invite`) — never automatic.
- **Graph operations:** `POST /users/{sender}/events` (create),
  `PATCH /users/{sender}/events/{id}` (update), event cancel (a 404 on cancel
  is treated as idempotent success).
- **Data transmitted:** meeting subject and HTML body; start/end as absolute
  UTC instants (Outlook renders each attendee's local time — no per-meeting
  timezone plumbing needed); attendee names and email addresses with
  required/optional flags; either a validated http(s) Teams link or
  `isOnlineMeeting: true` to let Teams generate one.
- **State kept locally:** `meetings.outlook_event_id` links the row to the
  Graph event, enabling update-instead-of-duplicate and cancellation;
  cleared on cancel.

## 4. Outbound telemetry (usage forwarding)

- **Trigger:** any usage event, when `USAGE_TRACKING_URL` is set
  (production-only configuration; unset in development → forwarding
  `disabled`).
- **Mechanism:** fire-and-forget GET to the corporate UsageTracking API with
  query parameters `Program`, `Addin`, `Version`, `Usage`, `Username`,
  `TimeStamp` (UTC `yyyy-MM-dd HH:mm:ss.fff`), `UsageUnit`. 8-second timeout;
  outcome stored per event (`forward_status`: pending → sent/failed, with
  error text). Failures never affect the user-facing operation.
- **Data transmitted:** the usage catalog identifiers and the acting user's
  email/username — no request or project content.

## 5. Inbound — legacy tracker import

- **Path:** `POST /api/import/tracker` (admin-only), multipart upload of the
  legacy Excel/CSV tracker.
- **Processing:** parsed in-memory (`@workspace/tracker-import`), normalized,
  content-hashed per row (idempotent re-imports), staged in
  `imported_tracker_rows`, then promoted into requests. `dryRun` previews the
  plan without writing. Audited (`import_tracker`) and usage-tracked.
- No external service is contacted.

## 6. Explicit non-integrations

For reviewer clarity, the system does **not**:

- call any AI/LLM service;
- use Replit-proprietary storage or auth SDKs in the production path (the
  OIDC issuer is configurable; all outbound calls are plain fetch);
- send the six coordinator email drafts automatically (manual by design);
- read any mailbox or calendar (no `*.Read` permissions requested);
- perform free-busy/availability lookups;
- embed third-party analytics, fonts, or CDNs in the frontend.
