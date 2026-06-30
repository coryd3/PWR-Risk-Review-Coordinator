---
name: Required attendee roles
description: Policy that certain risk-review attendee roles are mandatory
---

The PWR Risk Review intake treats a fixed set of attendee roles as mandatory:
each must exist on a request AND have at least one named person. As of this
writing the set is Business-Line Director, Project Manager, Engineering Manager,
Biz Develop/Capture Manager, Executive-in-Charge, Attorney.

**Why:** The original MS Form marked these roles required; coordinators cannot
schedule a review without them, so the app must flag/block their absence.

**Decisions to keep consistent:**
- Keep ONE source of truth for the list on the backend and have both the
  validation/warning path and the public config read from it. The form must not
  hardcode its own copy — it consumes the config list.
- "Populated" means at least one attendee with that role has a non-empty name
  (matches the backend's hasNamedAttendee semantics). Validate per-role, not
  per-row, so extra/duplicate same-role rows don't cause false negatives.
- The same required set applies regardless of EPC-prime status.
- When pre-seeding required rows in the form, never drop existing attendees:
  surface one canonical row per required role, but preserve all other rows
  (including additional same-role duplicates). Editing must not lose data.
