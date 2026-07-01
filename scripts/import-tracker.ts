/**
 * import-tracker.ts — Legacy Excel risk-tracker importer.
 *
 * Imports the team's legacy "risk review tracker" spreadsheet (the old
 * MS Forms + Power Automate + Excel workflow) into the PWR Risk Review
 * Coordinator database so historical reviews are not lost.
 *
 * What it does:
 *   1. Reads an .xlsx / .xls / .csv export. Each data row maps to one request.
 *   2. Stages every raw row into the `imported_tracker_rows` table (verbatim
 *      JSON + a content hash) for auditing before/after promotion.
 *   3. Normalizes each row (money strings -> numeric, business-line cells ->
 *      array, free-text trigger column -> canonical risk triggers, role columns
 *      -> attendees) and creates `risk_review_requests` plus related
 *      `request_risk_triggers`, `attendees`, and `meetings`, running the same
 *      Major/Non-Major + business-line classification used by the API.
 *   4. Is idempotent: re-running the same file skips rows already imported
 *      (matched by content hash) and never creates duplicate requests for a
 *      CRM opportunity number that already exists.
 *   5. Records a usage event per imported row (manual data entry avoided) so
 *      the app's impact metrics include historical imports.
 *   6. Prints a summary: rows read, imported, skipped (with reasons), errors.
 *      It never silently drops a row.
 *
 * The parsing/classification and per-row decision logic lives in the pure,
 * test-covered modules scripts/lib/tracker-normalize.ts and
 * scripts/lib/tracker-plan.ts. This file is the thin I/O shell that reads the
 * workbook and performs the database writes a plan dictates.
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
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  riskReviewRequestsTable,
  riskTriggersTable,
  requestRiskTriggersTable,
  attendeesTable,
  meetingsTable,
  importedTrackerRowsTable,
  auditEventsTable,
  usageEventsTable,
} from "@workspace/db";
import { REQUIRED_ATTENDEE_ROLES, type RawRow } from "./lib/tracker-normalize";
import { planRow, type PlanDeps, type PlannedImport } from "./lib/tracker-plan";

// Minutes of manual data entry saved per imported tracker row. Mirrors
// USAGE_ACTIONS.tracker_imported.minutesPerUnit in the api-server constants
// (replicated inline to avoid a cross-artifact import).
const USAGE_TRACKER_MINUTES_PER_ROW = 5;

interface RowOutcome {
  rowNumber: number;
  label: string;
  result: "imported" | "skipped" | "error";
  reason?: string;
}

// Live database lookups used by planRow's idempotency / duplicate guards.
const dbDeps: PlanDeps = {
  async getStagedByHash(hash) {
    const rows = await db
      .select()
      .from(importedTrackerRowsTable)
      .where(eq(importedTrackerRowsTable.rowHash, hash));
    const prior = rows[0];
    if (!prior) return undefined;
    return { processed: prior.processed, requestId: prior.requestId };
  },
  async getRequestIdByCrm(crm) {
    const rows = await db
      .select({ id: riskReviewRequestsTable.id })
      .from(riskReviewRequestsTable)
      .where(eq(riskReviewRequestsTable.crmOpportunityNumber, crm));
    return rows[0]?.id;
  },
};

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

  const workbook = XLSX.read(fs.readFileSync(resolved), { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("No worksheets found in file.");
    process.exit(1);
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: null,
    raw: true,
  });

  console.log(`Loaded ${rows.length} data row(s) from sheet "${sheetName}".`);

  // Load canonical triggers once.
  const allTriggers = await db.select().from(riskTriggersTable);

  const outcomes: RowOutcome[] = [];
  let imported = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // +1 for header, +1 for 1-based display
    const row = rows[i];

    let plan;
    try {
      plan = await planRow(row, rowNumber, allTriggers, dbDeps);
    } catch (err) {
      errored++;
      const message = err instanceof Error ? err.message : String(err);
      outcomes.push({
        rowNumber,
        label: `row ${rowNumber}`,
        result: "error",
        reason: message,
      });
      continue;
    }

    if (plan.kind === "empty") continue;

    if (plan.kind === "skip") {
      skipped++;
      outcomes.push({
        rowNumber,
        label: plan.label,
        result: "skipped",
        reason: plan.reason,
      });
      if (plan.stage && !dryRun) {
        await stageOnly(sourceFile, rowNumber, plan.rowHash, row, plan.reason);
      }
      continue;
    }

    // plan.kind === "import"
    const { payload } = plan;
    const detail = importDetail(payload);

    if (dryRun) {
      imported++;
      outcomes.push({
        rowNumber,
        label: plan.label,
        result: "imported",
        reason: `would import (${detail})`,
      });
      continue;
    }

    try {
      await promote(sourceFile, rowNumber, plan.rowHash, row, payload);
      imported++;
      outcomes.push({
        rowNumber,
        label: plan.label,
        result: "imported",
        reason: detail,
      });
    } catch (err) {
      errored++;
      const message = err instanceof Error ? err.message : String(err);
      outcomes.push({
        rowNumber,
        label: plan.label,
        result: "error",
        reason: message,
      });
      try {
        await stageOnly(
          sourceFile,
          rowNumber,
          plan.rowHash,
          row,
          message,
          "error",
        );
      } catch {
        /* staging failure should not mask the original error */
      }
    }
  }

  printSummary(sourceFile, rows.length, imported, skipped, errored, outcomes, dryRun);
}

// Human-readable summary of what an import payload contains.
function importDetail(payload: PlannedImport): string {
  const base = `${payload.matched.length} trigger(s), ${payload.attendees.length} attendee(s), ${payload.meetings.length} meeting(s)`;
  return payload.noteSuffix ? `${base} — ${payload.noteSuffix}` : base;
}

// Promote a planned import into the database in a single transaction.
async function promote(
  sourceFile: string,
  rowNumber: number,
  rowHash: string,
  row: RawRow,
  payload: PlannedImport,
): Promise<void> {
  const { requestValues, matched, attendees, meetings, finalNotes } = payload;
  await db.transaction(async (tx) => {
    const insertedReq = await tx
      .insert(riskReviewRequestsTable)
      .values({ ...requestValues, notes: finalNotes })
      .returning();
    const requestId = insertedReq[0].id;

    if (matched.length > 0) {
      await tx
        .insert(requestRiskTriggersTable)
        .values(matched.map((t) => ({ requestId, triggerId: t.id })));
    }
    if (attendees.length > 0) {
      await tx.insert(attendeesTable).values(
        attendees.map((a) => ({
          requestId,
          name: a.name,
          email: a.email,
          role: a.role,
          source: "import",
          isRequired: REQUIRED_ATTENDEE_ROLES.has(a.role),
        })),
      );
    }
    if (meetings.length > 0) {
      await tx.insert(meetingsTable).values(
        meetings.map((m) => ({
          requestId,
          meetingType: m.meetingType,
          targetDate: m.targetDate,
          status: "Needs Scheduling",
          riskLead: m.riskLead,
        })),
      );
    }

    await tx
      .insert(importedTrackerRowsTable)
      .values({
        sourceFile,
        rowNumber,
        rowHash,
        sourceRow: JSON.stringify(row),
        requestId,
        status: "imported",
        processed: true,
      })
      .onConflictDoUpdate({
        target: importedTrackerRowsTable.rowHash,
        set: {
          sourceFile,
          rowNumber,
          sourceRow: JSON.stringify(row),
          requestId,
          status: "imported",
          error: null,
          processed: true,
          importedAt: new Date(),
        },
      });

    await tx.insert(auditEventsTable).values({
      entityType: "request",
      entityId: requestId,
      action: "import",
      actor: "import-tracker",
      detail: JSON.stringify({
        sourceFile,
        rowNumber,
        crmOpportunityNumber: requestValues.crmOpportunityNumber,
        projectName: requestValues.projectName,
      }),
    });

    // Usage tracking: each imported row is manual data entry avoided.
    // Values mirror USAGE_ACTIONS.tracker_imported in the api-server
    // constants (replicated inline to avoid a cross-artifact import).
    await tx.insert(usageEventsTable).values({
      program: "PWR Risk Review Coordinator",
      addin: "Import",
      version: "1.0.0",
      usage: "Batch_PWR_RiskCoordinator_ImportTrackerRow",
      action: "tracker_imported",
      username: "import-tracker",
      usageUnit: 1,
      minutesPerUnit: USAGE_TRACKER_MINUTES_PER_ROW,
      minutesSaved: USAGE_TRACKER_MINUTES_PER_ROW,
      entityType: "request",
      entityId: requestId,
      source: "import",
      forwardStatus: "disabled",
      detail: JSON.stringify({ sourceFile, rowNumber }),
    });
  });
}

// Stage a raw row without promoting it (used for skipped / errored rows).
async function stageOnly(
  sourceFile: string,
  rowNumber: number,
  rowHash: string,
  row: RawRow,
  reason: string,
  status: "skipped" | "error" = "skipped",
): Promise<void> {
  await db
    .insert(importedTrackerRowsTable)
    .values({
      sourceFile,
      rowNumber,
      rowHash,
      sourceRow: JSON.stringify(row),
      status,
      error: reason,
      processed: false,
    })
    .onConflictDoUpdate({
      target: importedTrackerRowsTable.rowHash,
      set: {
        sourceFile,
        rowNumber,
        sourceRow: JSON.stringify(row),
        status,
        error: reason,
        processed: false,
        importedAt: new Date(),
      },
    });
}

function printSummary(
  sourceFile: string,
  rowsRead: number,
  imported: number,
  skipped: number,
  errored: number,
  outcomes: RowOutcome[],
  dryRun: boolean,
): void {
  console.log("");
  console.log(`Import summary for ${sourceFile}${dryRun ? " (dry run)" : ""}:`);
  console.log(`  Rows read: ${rowsRead}`);
  console.log(`  Imported:  ${imported}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errored}`);
  if (outcomes.length > 0) {
    console.log("  Details:");
    for (const o of outcomes) {
      const tag = o.result.toUpperCase().padEnd(8);
      console.log(
        `    [${tag}] row ${o.rowNumber} — ${o.label}${o.reason ? `: ${o.reason}` : ""}`,
      );
    }
  }
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Import failed:", err);
    await pool.end();
    process.exit(1);
  });
