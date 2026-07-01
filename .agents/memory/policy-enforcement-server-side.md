---
name: Policy enforcement server-side
description: Packet business rules (who/when/scope) must be enforced in the API, not only the UI.
---

Business-rule scoping from Megan's packet (e.g. "calendar invite only for
Pre-Risk", recipient routing by request type) must be enforced in the API route,
not just hidden in the React UI.

**Why:** An acceptance/architect review will FAIL a feature that only gates
behavior in the frontend, because the endpoint is still reachable directly and
can produce out-of-policy output (e.g. a Formal/Final calendar preview).

**How to apply:** Whenever you gate something in a page/section by request type
or stage, add the matching guard in the corresponding Express route (reject with
400 or force the allowed value). Match request/template type with a lowercase
`.includes("pre-risk")` style check — "final risk review request" does NOT
contain "pre-risk", so that substring cleanly distinguishes Pre-Risk.
