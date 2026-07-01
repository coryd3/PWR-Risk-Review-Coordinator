/**
 * import-tracker.ts — Legacy Excel risk-tracker importer (CLI).
 *
 * Thin command-line wrapper around the shared @workspace/tracker-import library,
 * which holds all parsing, normalization, classification, staging and promotion
 * logic. The in-app upload endpoint (artifacts/api-server) calls the same
 * library, so the CLI and the web UI import historical reviews identically.
 *
 * What it does:
 *   1. Reads an .xlsx / .xls / .csv export. Each data row maps to one request.
 *   2. Stages every raw row into the `imported_tracker_rows` table (verbatim
 *      JSON + a content hash) for auditing before/after promotion.
 *   3. Normalizes each row and creates `risk_review_requests` plus related
 *      `request_risk_triggers`, `attendees`, and `meetings`, running the same
 *      Major/Non-Major + business-line classification used by the API.
 *   4. Is idempotent: re-running the same file skips rows already imported
 *      (matched by content hash) and never creates duplicate requests for a
 *      CRM opportunity number that already exists.
 *   5. Prints a summary: rows read, imported, skipped (with reasons), errors.
 *      It never silently drops a row.
 *
 * Safety: performs NO external calls (no email, Outlook, or Graph). It only
 * reads a local file and writes to the PostgreSQL database via DATABASE_URL.
 *
 * Usage:
 *   pnpm tsx scripts/import-tracker.ts <path-to-tracker.(xlsx|csv)> [--dry-run]
 *   pnpm --filter @workspace/scripts run import -- <path> [--dry-run]
 *
 * A small fake sample lives at scripts/fixtures/sample-tracker.csv:
 *   pnpm tsx scripts/import-tracker.ts scripts/fixtures/sample-tracker.csv
 */
import path from "node:path";
import fs from "node:fs";
import { pool } from "@workspace/db";
import {
  importTrackerFile,
  TrackerParseError,
  type ImportSummary,
} from "@workspace/tracker-import";

function printSummary(summary: ImportSummary): void {
  console.log("");
  console.log(
    `Import summary for ${summary.sourceFile}${summary.dryRun ? " (dry run)" : ""}:`,
  );
  console.log(`  Rows read: ${summary.rowsRead}`);
  console.log(`  Imported:  ${summary.imported}`);
  console.log(`  Skipped:   ${summary.skipped}`);
  console.log(`  Errors:    ${summary.errored}`);
  if (summary.outcomes.length > 0) {
    console.log("  Details:");
    for (const o of summary.outcomes) {
      const tag = o.result.toUpperCase().padEnd(8);
      console.log(
        `    [${tag}] row ${o.rowNumber} — ${o.label}${o.reason ? `: ${o.reason}` : ""}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error(
      "Usage: pnpm tsx scripts/import-tracker.ts <path-to-tracker.(xlsx|csv)> [--dry-run]",
    );
    process.exit(1);
  }
  // pnpm runs scripts with cwd set to the package dir, but exposes the
  // directory the user actually invoked the command from via INIT_CWD. Resolve
  // relative paths against that so `pnpm run db:import <relative>` works from
  // the repo root as documented.
  const baseDir = process.env.INIT_CWD || process.cwd();
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(baseDir, filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const sourceFile = path.basename(resolved);
  console.log(`Reading tracker: ${resolved}${dryRun ? " (dry run)" : ""}`);

  const buffer = fs.readFileSync(resolved);
  const summary = await importTrackerFile(buffer, { sourceFile, dryRun });
  console.log(
    `Loaded ${summary.rowsRead} data row(s) from "${sourceFile}".`,
  );
  printSummary(summary);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    if (err instanceof TrackerParseError) {
      console.error(`Import failed: ${err.message}`);
    } else {
      console.error("Import failed:", err);
    }
    await pool.end();
    process.exit(1);
  });
