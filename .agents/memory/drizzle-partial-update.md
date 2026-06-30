---
name: Drizzle partial update guard
description: How to safely handle partial PUT update bodies with Drizzle .set()
---

Drizzle's `.update(table).set(values)` throws a runtime 500 (`Error: No values to set`)
when `values` has zero own keys. An all-optional zod body parsed from `{}` produces
exactly that.

**Rule:** For PUT/PATCH handlers, after `safeParse` (not `.parse`, which throws ZodError → 500),
strip `undefined` keys and return `400 "No updatable fields provided"` if nothing remains
before calling `.set()`.

**Why:** A prior acceptance review failed because the config PUT endpoints returned 500 on
empty `{}` bodies and on invalid types. safeParse + a pickDefined helper + empty guard makes
them return controlled 400s.

**How to apply:** Pattern lives in `artifacts/api-server/src/routes/config/index.ts`
(`pickDefined` helper + the three `/risk-triggers|/email-templates|/rule-sets/:id` PUTs).
Note: other routes still use `.parse()` and would 500 on bad bodies — only the config
routes were hardened.
