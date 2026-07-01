---
name: usage-tracking subsystem
description: Design decisions for the usage_events impact-tracking subsystem (hours/dollars saved) and external forwarding.
---

# Usage tracking subsystem

Tracks value delivered (hours/dollars saved vs manual effort) via `usage_events`,
surfaced on the frontend Impact page and forwarded to an external Azure
UsageTracking API.

## External forwarding is production-only by design
`forwardUsage()` only fires when `USAGE_TRACKING_URL` is set, and that env var is
set in the **production** environment only.
**Why:** dev/test must never POST fabricated events to the real external system.
**How to apply:** never move `USAGE_TRACKING_URL` to `shared`/`development`. If
forwarding needs local testing, use a throwaway URL in `development` only.

## POST /api/usage is intentionally open (no auth)
The whole api-server has no auth middleware (internal Burns & McDonnell tool), so
the open usage-ingest endpoint is consistent, not an oversight. It exists so future
platforms (Databricks App, Outlook/Graph add-in) can report usage cross-platform.
**Why:** portability was an explicit requirement; adding auth to one endpoint while
the rest is open would be inconsistent.
**How to apply:** if auth is ever added, add it app-wide, not just to /usage. A code
review flagging "open endpoint" here is a known accepted tradeoff.

## Impact math
`minutesSaved = usageUnit * minutesPerUnit` is frozen on each row at write time
(catalog `minutesPerUnit` from USAGE_ACTIONS). Hours/dollars are derived at read
time in `/usage/summary`: hours = minutes/60, dollars = hours * BURDENED_LABOR_RATE_USD ($85).
Rounding to 2dp happens only in the API response, never in stored columns.
