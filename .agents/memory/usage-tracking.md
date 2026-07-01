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

## POST /api/usage is now behind auth + RBAC (was open)
The api-server now has Replit-Auth + 4-role RBAC app-wide (health/auth public,
everything else behind `authorizeByRole`). POST /usage is NOT special-cased and
falls to the default mutation policy (contributor/admin). No web client calls it
directly — usage is recorded server-side inside route handlers via recordUsage().
**Why:** the "no auth, open endpoint" tradeoff was retired when RBAC was added;
enforcement is now consistent app-wide.
**How to apply:** if a future cross-platform reporter (Databricks App, Graph add-in)
must POST /usage without a session, add an explicit service-token path — do NOT
reopen the endpoint to anonymous.

## BMcD governance naming + API fields
`usage` event names follow `<Platform>_<System>_<Tool>_<Action>` (e.g.
`Web_PWR_RiskCoordinator_CreateRequest`, `Batch_..._ImportTrackerRow` for the CLI
importer). These are the governance-stable identifiers; the friendly UI name is a
separate `label`. Forwarded GET params: Program, Addin, Version, Usage, Username,
TimeStamp (UTC `yyyy-MM-dd HH:mm:ss.fff`), UsageUnit. Dollars are NEVER sent — the
external dashboard applies Hours=TimeSaved×UsageUnit, Dollars=Hours×85.
**Why:** the BMcD Usage Tracking implementation guide requires stable coded names
and expects the governance layer (not the tool) to compute dollars.
**How to apply:** never rename a `usage` value once handed to dashboard governance.
SettingGP/SettingDept/SettingClient are optional and currently NOT sent (need
governance values from the user before adding).

## Impact math
`minutesSaved = usageUnit * minutesPerUnit` is frozen on each row at write time
(catalog `minutesPerUnit` from USAGE_ACTIONS). Hours/dollars are derived at read
time in `/usage/summary`: hours = minutes/60, dollars = hours * BURDENED_LABOR_RATE_USD ($85).
Rounding to 2dp happens only in the API response, never in stored columns.
