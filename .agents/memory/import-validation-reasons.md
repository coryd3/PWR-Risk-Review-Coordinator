---
name: Tracker import validation reasons
description: Which import data problems block a row vs. warn, and how reasons/warnings flow from planRow to the UI.
---

# Tracker import: blocking errors vs. non-blocking warnings

`planRow` (lib/tracker-import) classifies each legacy-tracker row. Data problems split into two tiers:

- **Blocking (`kind: "error"`, counts as errored, staged):** unparseable date cells (a cell with content that `parseDate` can't read). Blocking here is deliberate — importing anyway would silently drop the date and its meeting.
- **Non-blocking (`kind: "import"` + `payload.warnings: string[]`):** unrecognized risk triggers, missing required attendee roles, missing Client Name. The row still imports.
- **Skip (`kind: "skip"`):** no Project Name and no CRM (no identity), already-imported, CRM duplicate.

**Why:** the goal is a coordinator can fix the source file and re-import. Genuine data loss = block; advisory = warn but keep the migration moving. Aligns with the project's "no silent fallbacks" principle.

**How to apply:**
- Reason strings are consumed by tests via substring/regex match — keep existing phrases (`already imported`, `request already exists for CRM ... (id N)`, `missing both Project Name and CRM Opportunity Number`) intact when editing.
- `warnings` is a new field: it lives on `ImportOutcome`/`PlannedImport`, is declared in `lib/api-spec/openapi.yaml` (ImportOutcome), and must be regenerated with `pnpm --filter @workspace/api-spec run codegen` after any schema change.
- The Import.tsx screen groups error rows and warning rows into highlighted sections above the full list.
