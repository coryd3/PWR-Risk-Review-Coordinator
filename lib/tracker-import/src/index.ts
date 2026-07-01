/**
 * @workspace/tracker-import — Shared legacy Excel risk-tracker import logic.
 *
 * This is the single source of truth for parsing, normalizing, classifying,
 * staging and promoting the team's legacy "risk review tracker" spreadsheet
 * (the old MS Forms + Power Automate + Excel workflow) into the PWR Risk Review
 * Coordinator database.
 *
 * It is consumed by:
 *   - scripts/import-tracker.ts (the `pnpm run db:import` CLI), and
 *   - artifacts/api-server (the in-app upload endpoint),
 * so both run the *exact same* staging + import behaviour.
 *
 * The pure, DB-free parsing/classification and per-row decision logic lives in
 * the test-covered sibling modules ./tracker-normalize and ./tracker-plan. This
 * file is the I/O shell: it parses the workbook buffer, wires the real database
 * into `planRow`, and performs the writes a plan dictates (including audit and
 * usage-tracking events).
 *
 * Behaviour:
 *   1. Reads an .xlsx / .xls / .csv workbook buffer. Each data row -> one request.
 *   2. Stages every raw row into `imported_tracker_rows` (verbatim JSON + a
 *      content hash) for auditing before/after promotion.
 *   3. Normalizes each row and creates `risk_review_requests` plus related
 *      `request_risk_triggers`, `attendees`, and `meetings`, running the same
 *      Major/Non-Major + business-line classification used by the API.
 *   4. Is idempotent: re-running the same file skips rows already imported
 *      (matched by content hash) and never creates duplicate requests for a
 *      CRM opportunity number that already exists.
 *   5. Records a usage event per imported row (manual data entry avoided) so
 *      the app's impact metrics include historical imports.
 *   6. Returns a structured summary: rows read, imported, skipped (with
 *      reasons), errors. It never silently drops a row.
 *   7. Supports a dry-run mode that reports what *would* happen without writing.
 *
 * Safety: performs NO external calls (no email, Outlook, or Graph). It only
 * reads the provided buffer and writes to PostgreSQL via the shared `db`.
 */
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import {
  db,
  riskReviewRequestsTable,
  riskTriggersTable,
  requestRiskTriggersTable,
  attendeesTable,
  meetingsTable,
  importedTrackerRowsTable,
  auditEventsTable,
  usageEventsTable,
} from "@workspace/db";
import { REQUIRED_ATTENDEE_ROLES, type RawRow } from "./tracker-normalize";
import { planRow, type PlanDeps, type PlannedImport } from "./tracker-plan";

// Re-export the pure parsing/planning modules so consumers (and their tests)
// have a single import surface for the tracker-import logic.
export * from "./tracker-normalize";
export * from "./tracker-plan";

// Minutes of manual data entry saved per imported tracker row. Mirrors
// USAGE_ACTIONS.tracker_imported.minutesPerUnit in the api-server constants
// (replicated inline to avoid a cross-artifact import).
const USAGE_TRACKER_MINUTES_PER_ROW = 5;

export interface ImportOutcome {
  rowNumber: number;
  label: string;
  result: "imported" | "skipped" | "error";
  reason?: string;
}

export interface ImportSummary {
  sourceFile: string;
  dryRun: boolean;
  rowsRead: number;
  imported: number;
  skipped: number;
  errored: number;
  outcomes: ImportOutcome[];
}

export interface ImportOptions {
  /** Original filename, recorded for staging/audit (e.g. "tracker.xlsx"). */
  sourceFile: string;
  /** When true, classify and report without writing anything. */
  dryRun?: boolean;
  /** Audit actor recorded for each imported request. */
  actor?: string;
}

export class TrackerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackerParseError";
  }
}

// Parse an .xlsx/.xls/.csv workbook buffer into raw spreadsheet rows. Throws a
// TrackerParseError when the file cannot be read as a worksheet.
export function parseTrackerBuffer(buffer: Buffer | Uint8Array): RawRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new TrackerParseError(
      `Could not read the file as a spreadsheet: ${message}`,
    );
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new TrackerParseError("No worksheets found in file.");
  }
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: null,
    raw: true,
  });
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

// Human-readable summary of what an import payload contains.
function importDetail(payload: PlannedImport): string {
  const base = `${payload.matched.length} trigger(s), ${payload.attendees.length} attendee(s), ${payload.meetings.length} meeting(s)`;
  return payload.noteSuffix ? `${base} — ${payload.noteSuffix}` : base;
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

// Promote a planned import into the database in a single transaction. Also
// records an audit event and a usage event (manual data entry avoided).
async function promote(
  sourceFile: string,
  rowNumber: number,
  rowHash: string,
  row: RawRow,
  payload: PlannedImport,
  actor: string,
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
      actor,
      detail: JSON.stringify({
        sourceFile,
        rowNumber,
        crmOpportunityNumber: requestValues.crmOpportunityNumber,
        projectName: requestValues.projectName,
      }),
    });

    // Usage tracking: each imported row is manual data entry avoided. Values
    // mirror USAGE_ACTIONS.tracker_imported in the api-server constants
    // (replicated inline to avoid a cross-artifact import).
    await tx.insert(usageEventsTable).values({
      program: "PWR Risk Review Coordinator",
      addin: "Import",
      version: "1.0.0",
      usage: "Legacy Tracker Import",
      action: "tracker_imported",
      username: actor,
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

// Run the staging + import over already-parsed rows. Shared by the CLI and the
// in-app upload endpoint so both behave identically.
export async function importTrackerRows(
  rows: RawRow[],
  options: ImportOptions,
): Promise<ImportSummary> {
  const { sourceFile, dryRun = false, actor = "import-tracker" } = options;

  // Load canonical triggers once.
  const allTriggers = await db.select().from(riskTriggersTable);

  const outcomes: ImportOutcome[] = [];
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
      await promote(sourceFile, rowNumber, plan.rowHash, row, payload, actor);
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

  return {
    sourceFile,
    dryRun,
    rowsRead: rows.length,
    imported,
    skipped,
    errored,
    outcomes,
  };
}

// Convenience: parse a workbook buffer and run the import in one call.
export async function importTrackerFile(
  buffer: Buffer | Uint8Array,
  options: ImportOptions,
): Promise<ImportSummary> {
  const rows = parseTrackerBuffer(buffer);
  return importTrackerRows(rows, options);
}
