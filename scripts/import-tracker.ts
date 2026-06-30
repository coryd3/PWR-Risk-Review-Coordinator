/**
 * import-tracker.ts — STUB (Not implemented in MVP)
 *
 * Future utility to import the legacy Excel "risk review tracker" into the
 * PWR Risk Review Coordinator database. This replaces the manual
 * MS Forms + Power Automate + Excel workflow.
 *
 * Intended design (documented, not built in the MVP):
 *   1. Read an .xlsx export of the existing tracker (e.g. via a library such as
 *      `xlsx`/`exceljs`). Each row maps to one risk review request.
 *   2. Normalize/clean each row:
 *        - Parse contract value strings (e.g. "$45,000,000") into numeric values.
 *        - Split combined business-line cells into the business_lines array.
 *        - Map free-text risk-trigger columns onto the canonical 20 risk triggers.
 *        - Resolve attendee names/emails into attendee rows grouped by role.
 *   3. Stage raw rows into the `imported_tracker_rows` table for auditing before
 *      promotion, then create `risk_review_requests` (+ related records) via the
 *      same backend services used by the API so classification/validation run.
 *   4. Re-run classification (Major/Non-Major, business line) and write
 *      validation warnings; never silently drop rows — report failures.
 *
 * Safety: this script performs NO external calls (no email, Outlook, or Graph).
 * It only reads a local file and writes to the configured PostgreSQL database
 * via DATABASE_URL.
 *
 * Usage (future): pnpm tsx scripts/import-tracker.ts <path-to-tracker.xlsx>
 */

function main(): never {
  throw new Error(
    "import-tracker is not implemented in the MVP. This is a documented stub " +
      "for the future Excel tracker import. See comments in scripts/import-tracker.ts.",
  );
}

main();
