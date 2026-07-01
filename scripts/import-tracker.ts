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
import crypto from "node:crypto";
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
  type RiskTriggerRow,
} from "@workspace/db";

// --- Configuration kept in sync with the backend rule/constants services. ---
// (artifacts/api-server/src/lib/{rules,constants,requestService}.ts). Replicated
// here, as the seed script does, to avoid a cross-artifact import of the
// Express server package from this standalone tooling package.

// Minutes of manual data entry saved per imported tracker row. Mirrors
// USAGE_ACTIONS.tracker_imported.minutesPerUnit in the api-server constants.
const USAGE_TRACKER_MINUTES_PER_ROW = 5;

const ATTENDEE_ROLES = [
  "Business-Line Director",
  "Business Line CDB Operations Manager",
  "Project Manager",
  "Engineering Manager",
  "Construction Manager",
  "Self-Perform PM",
  "Biz Develop/Capture Manager",
  "Executive-in-Charge",
  "Attorney",
  "Regional GP Manager",
  "Regional Risk Manager",
  "Other Attendees",
] as const;

const REQUIRED_ATTENDEE_ROLES = new Set([
  "Business-Line Director",
  "Project Manager",
  "Engineering Manager",
  "Biz Develop/Capture Manager",
  "Executive-in-Charge",
  "Attorney",
]);

// Parses a free-form money string ("$50,000,000", "50M") into a number.
function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const multiplier = /m$/i.test(trimmed)
    ? 1_000_000
    : /k$/i.test(trimmed)
      ? 1_000
      : 1;
  const numeric = Number(trimmed.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(numeric)) return null;
  return numeric * multiplier;
}

// A request is Major if it includes trigger 1 or 2 (or a Major-flagged trigger).
function classifyMajor(
  triggers: Pick<
    RiskTriggerRow,
    "triggerNumber" | "isMajorOpportunityTrigger"
  >[],
): boolean {
  return triggers.some(
    (t) =>
      t.isMajorOpportunityTrigger ||
      t.triggerNumber === 1 ||
      t.triggerNumber === 2,
  );
}

function classifyBusinessLine(businessLines: string[]): string {
  const has = (n: string) =>
    businessLines.some((b) => b.toLowerCase() === n.toLowerCase());
  if (has("BESS") && has("Solar")) return "BESS + Solar";
  if (has("BESS")) return "BESS";
  if (has("Solar")) return "Solar";
  if (has("GHI")) return "GHI";
  return "Other";
}

// --- Header mapping --------------------------------------------------------
// Normalize a header/value key to lowercase alphanumerics so the importer
// tolerates spacing, punctuation, and casing differences in the legacy sheet.
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const FIELD_ALIASES: Record<string, string[]> = {
  requesterName: ["requester name", "requester", "submitted by"],
  requesterEmail: ["requester email", "requester e-mail", "email"],
  clientName: ["client name", "client"],
  projectName: ["project name", "project", "opportunity name"],
  crmOpportunityNumber: [
    "crm opportunity number",
    "crm opportunity #",
    "crm #",
    "opportunity number",
    "opportunity #",
    "crm",
  ],
  bmcdContractValueRaw: [
    "bmcd contract value",
    "bmcd contract value ($)",
    "bmcd value",
    "contract value",
  ],
  totalInstalledCostRaw: [
    "total installed cost (tic)",
    "total installed cost",
    "tic",
  ],
  businessLines: ["business line", "business lines", "business line(s)"],
  contractReviewRvwNumber: [
    "contract review request rvw #",
    "contract review rvw #",
    "rvw #",
    "rvw number",
    "rvw",
  ],
  isEpcPrime: ["epc prime", "epc-prime", "is epc prime", "epc prime?"],
  requestType: ["request type", "type"],
  riskIdentificationStatus: [
    "risk identification status",
    "risk identification meeting status",
    "risk id status",
  ],
  preRiskTargetDate: [
    "pre-risk target date",
    "pre risk target date",
    "pre-risk date",
  ],
  formalRiskTargetDate: ["formal risk target date", "formal risk date"],
  proposalDueDate: ["proposal due date", "proposal date"],
  formalRiskDiscussionDate: ["formal risk discussion date"],
  finalRiskTargetDate: ["final risk target date", "final risk date"],
  preRiskLead: ["pre-risk lead", "pre risk lead", "pre-risk review lead"],
  formalRiskLead: ["formal risk lead", "formal risk discussion risk lead"],
  status: ["status"],
  nextAction: ["next action"],
  owner: ["owner", "coordinator"],
  notes: ["notes", "comments", "other comments"],
  riskTriggers: [
    "risk triggers",
    "triggers",
    "risk trigger numbers",
    "trigger numbers",
    "risk trigger",
  ],
};

type RawRow = Record<string, unknown>;

function buildLookup(row: RawRow): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v);
  return map;
}

function pickRaw(
  lookup: Map<string, unknown>,
  aliases: string[],
): unknown {
  for (const alias of aliases) {
    const key = norm(alias);
    if (lookup.has(key)) {
      const v = lookup.get(key);
      if (v != null && String(v).trim() !== "") return v;
    }
  }
  return null;
}

function pickString(
  lookup: Map<string, unknown>,
  aliases: string[],
): string | null {
  const v = pickRaw(lookup, aliases);
  return v == null ? null : String(v).trim();
}

function parseBool(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return ["yes", "y", "true", "t", "x", "1", "epc prime"].includes(s);
}

function splitList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[,;/|\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function pad(n: string | number): string {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Normalize a date cell (Date object, Excel serial, or string) to YYYY-MM-DD.
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return toYMD(v);
  if (typeof v === "number") {
    const parsed = XLSX.SSF?.parse_date_code?.(v);
    if (parsed && parsed.y) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    return null;
  }
  const s = String(v).trim();
  if (s === "") return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return `${year}-${pad(m[1])}-${pad(m[2])}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return toYMD(parsed);
  return null;
}

// Resolve the free-text trigger column into canonical trigger ids. Accepts
// trigger numbers ("1, 5"), the literal trigger name, or a clear substring.
function resolveTriggers(
  raw: string | null,
  triggers: RiskTriggerRow[],
): { matched: RiskTriggerRow[]; unmatched: string[] } {
  const tokens = splitList(raw);
  const matched: RiskTriggerRow[] = [];
  const unmatched: string[] = [];
  const seen = new Set<number>();
  for (const token of tokens) {
    let found: RiskTriggerRow | undefined;
    const num = Number(token.replace(/[^0-9]/g, ""));
    if (/^\d+$/.test(token.replace(/[^0-9]/g, "")) && !Number.isNaN(num)) {
      found = triggers.find((t) => t.triggerNumber === num);
    }
    if (!found) {
      const lower = token.toLowerCase();
      found = triggers.find(
        (t) =>
          t.triggerName.toLowerCase() === lower ||
          t.triggerName.toLowerCase().includes(lower) ||
          lower.includes(t.triggerName.toLowerCase()),
      );
    }
    if (found) {
      if (!seen.has(found.id)) {
        seen.add(found.id);
        matched.push(found);
      }
    } else {
      unmatched.push(token);
    }
  }
  return { matched, unmatched };
}

// Parse a "Name <email>" or "Name (email)" attendee cell.
function parseAttendeeCell(value: string): { name: string; email: string | null } {
  const angle = /<([^>]+)>/.exec(value);
  const paren = /\(([^)]+@[^)]+)\)/.exec(value);
  const email = angle?.[1] ?? paren?.[1] ?? null;
  const name = value.replace(/<[^>]+>/, "").replace(/\([^)]+\)/, "").trim();
  return { name: name || value.trim(), email: email ? email.trim() : null };
}

interface AttendeeRecord {
  name: string;
  email: string | null;
  role: string;
}

function extractAttendees(lookup: Map<string, unknown>): AttendeeRecord[] {
  const out: AttendeeRecord[] = [];
  for (const role of ATTENDEE_ROLES) {
    const cell = pickString(lookup, [role]);
    if (!cell) continue;
    // A role column can carry multiple people separated by ; or newlines.
    for (const part of cell.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean)) {
      const { name, email } = parseAttendeeCell(part);
      out.push({ name, email, role });
    }
  }
  return out;
}

// Deterministic content hash of a raw row, used for idempotency.
function hashRow(row: RawRow): string {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(row).sort()) {
    const v = row[key];
    normalized[norm(key)] = v == null ? "" : String(v).trim();
  }
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

interface RowOutcome {
  rowNumber: number;
  label: string;
  result: "imported" | "skipped" | "error";
  reason?: string;
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
    const lookup = buildLookup(row);

    const projectName = pickString(lookup, FIELD_ALIASES.projectName);
    const crm = pickString(lookup, FIELD_ALIASES.crmOpportunityNumber);
    const label = projectName ?? crm ?? `row ${rowNumber}`;

    // Skip fully-empty rows (trailing blank lines etc.).
    const nonEmpty = Array.from(lookup.values()).some(
      (v) => v != null && String(v).trim() !== "",
    );
    if (!nonEmpty) {
      continue;
    }

    const rowHash = hashRow(row);

    try {
      // Idempotency: a row already promoted (same content hash) is skipped.
      const existingStaged = await db
        .select()
        .from(importedTrackerRowsTable)
        .where(eq(importedTrackerRowsTable.rowHash, rowHash));
      const prior = existingStaged[0];
      if (prior && prior.processed && prior.requestId != null) {
        skipped++;
        outcomes.push({
          rowNumber,
          label,
          result: "skipped",
          reason: "already imported (row unchanged)",
        });
        continue;
      }

      // Minimum identity required to create a meaningful request.
      if (!projectName && !crm) {
        skipped++;
        const reason = "missing both Project Name and CRM Opportunity Number";
        outcomes.push({ rowNumber, label, result: "skipped", reason });
        if (!dryRun) await stageOnly(sourceFile, rowNumber, rowHash, row, reason);
        continue;
      }

      // Never create a duplicate request for an existing CRM opportunity.
      if (crm) {
        const dup = await db
          .select({ id: riskReviewRequestsTable.id })
          .from(riskReviewRequestsTable)
          .where(eq(riskReviewRequestsTable.crmOpportunityNumber, crm));
        if (dup.length > 0) {
          skipped++;
          const reason = `request already exists for CRM ${crm} (id ${dup[0].id})`;
          outcomes.push({ rowNumber, label, result: "skipped", reason });
          if (!dryRun)
            await stageOnly(sourceFile, rowNumber, rowHash, row, reason);
          continue;
        }
      }

      // Build the normalized request payload.
      const businessLines = splitList(
        pickString(lookup, FIELD_ALIASES.businessLines),
      );
      const { matched, unmatched } = resolveTriggers(
        pickString(lookup, FIELD_ALIASES.riskTriggers),
        allTriggers,
      );
      const attendees = extractAttendees(lookup);
      const bmcdRaw = pickString(lookup, FIELD_ALIASES.bmcdContractValueRaw);
      const ticRaw = pickString(lookup, FIELD_ALIASES.totalInstalledCostRaw);
      const requestType = pickString(lookup, FIELD_ALIASES.requestType);
      const preRiskTargetDate = parseDate(
        pickRaw(lookup, FIELD_ALIASES.preRiskTargetDate),
      );
      const formalRiskTargetDate = parseDate(
        pickRaw(lookup, FIELD_ALIASES.formalRiskTargetDate),
      );
      const finalRiskTargetDate = parseDate(
        pickRaw(lookup, FIELD_ALIASES.finalRiskTargetDate),
      );
      const preRiskLead = pickString(lookup, FIELD_ALIASES.preRiskLead);
      const formalRiskLead = pickString(lookup, FIELD_ALIASES.formalRiskLead);

      const requestValues = {
        requesterName: pickString(lookup, FIELD_ALIASES.requesterName),
        requesterEmail: pickString(lookup, FIELD_ALIASES.requesterEmail),
        clientName: pickString(lookup, FIELD_ALIASES.clientName),
        projectName,
        crmOpportunityNumber: crm,
        bmcdContractValueRaw: bmcdRaw,
        bmcdContractValueNumeric: parseMoney(bmcdRaw),
        totalInstalledCostRaw: ticRaw,
        totalInstalledCostNumeric: parseMoney(ticRaw),
        businessLines,
        businessLineClassification: classifyBusinessLine(businessLines),
        contractReviewRvwNumber: pickString(
          lookup,
          FIELD_ALIASES.contractReviewRvwNumber,
        ),
        isEpcPrime: parseBool(pickRaw(lookup, FIELD_ALIASES.isEpcPrime)),
        isMajorOpportunity: classifyMajor(matched),
        requestType,
        riskIdentificationStatus: pickString(
          lookup,
          FIELD_ALIASES.riskIdentificationStatus,
        ),
        preRiskTargetDate,
        formalRiskTargetDate,
        proposalDueDate: parseDate(
          pickRaw(lookup, FIELD_ALIASES.proposalDueDate),
        ),
        formalRiskDiscussionDate: parseDate(
          pickRaw(lookup, FIELD_ALIASES.formalRiskDiscussionDate),
        ),
        finalRiskTargetDate,
        preRiskLead,
        formalRiskLead,
        status: pickString(lookup, FIELD_ALIASES.status) ?? "New",
        nextAction: pickString(lookup, FIELD_ALIASES.nextAction),
        owner: pickString(lookup, FIELD_ALIASES.owner),
        notes: pickString(lookup, FIELD_ALIASES.notes),
      };

      // Synthesize meetings from whichever target dates are present.
      const meetings: {
        meetingType: string;
        targetDate: string;
        riskLead: string | null;
      }[] = [];
      if (preRiskTargetDate)
        meetings.push({
          meetingType: "Pre-Risk",
          targetDate: preRiskTargetDate,
          riskLead: preRiskLead,
        });
      if (formalRiskTargetDate)
        meetings.push({
          meetingType: "Formal Risk",
          targetDate: formalRiskTargetDate,
          riskLead: formalRiskLead,
        });
      if (finalRiskTargetDate)
        meetings.push({
          meetingType: "Final Risk",
          targetDate: finalRiskTargetDate,
          riskLead: formalRiskLead ?? preRiskLead,
        });

      const noteSuffix =
        unmatched.length > 0
          ? `Unmatched risk triggers from import: ${unmatched.join(", ")}.`
          : null;

      if (dryRun) {
        imported++;
        outcomes.push({
          rowNumber,
          label,
          result: "imported",
          reason: `would import (${matched.length} trigger(s), ${attendees.length} attendee(s), ${meetings.length} meeting(s))${
            noteSuffix ? ` — ${noteSuffix}` : ""
          }`,
        });
        continue;
      }

      await db.transaction(async (tx) => {
        const finalNotes =
          noteSuffix && requestValues.notes
            ? `${requestValues.notes}\n${noteSuffix}`
            : (requestValues.notes ?? noteSuffix);

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
            crmOpportunityNumber: crm,
            projectName,
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

      imported++;
      outcomes.push({
        rowNumber,
        label,
        result: "imported",
        reason: `${matched.length} trigger(s), ${attendees.length} attendee(s), ${meetings.length} meeting(s)${
          noteSuffix ? ` — ${noteSuffix}` : ""
        }`,
      });
    } catch (err) {
      errored++;
      const message = err instanceof Error ? err.message : String(err);
      outcomes.push({
        rowNumber,
        label,
        result: "error",
        reason: message,
      });
      if (!dryRun) {
        try {
          await stageOnly(sourceFile, rowNumber, rowHash, row, message, "error");
        } catch {
          /* staging failure should not mask the original error */
        }
      }
    }
  }

  printSummary(sourceFile, rows.length, imported, skipped, errored, outcomes, dryRun);
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
