/**
 * tracker-normalize.ts — Pure normalization helpers for the legacy tracker
 * importer.
 *
 * These functions perform NO I/O (no database, filesystem, or network access)
 * so they can be exercised directly by automated tests. The runtime importer
 * (scripts/import-tracker.ts) and the row planner (scripts/lib/tracker-plan.ts)
 * compose them. Keep all parsing/classification logic here.
 */
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import type { RiskTriggerRow } from "@workspace/db";

// --- Configuration kept in sync with the backend rule/constants services. ---
// (artifacts/api-server/src/lib/{rules,constants,requestService}.ts). Replicated
// here, as the seed script does, to avoid a cross-artifact import of the
// Express server package from this standalone tooling package.

export const ATTENDEE_ROLES = [
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

export const REQUIRED_ATTENDEE_ROLES = new Set<string>([
  "Business-Line Director",
  "Project Manager",
  "Engineering Manager",
  "Biz Develop/Capture Manager",
  "Executive-in-Charge",
  "Attorney",
]);

// Parses a free-form money string ("$50,000,000", "50M") into a number.
export function parseMoney(raw: string | null | undefined): number | null {
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
export function classifyMajor(
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

export function classifyBusinessLine(businessLines: string[]): string {
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
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export const FIELD_ALIASES: Record<string, string[]> = {
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

export type RawRow = Record<string, unknown>;

export function buildLookup(row: RawRow): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v);
  return map;
}

export function pickRaw(
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

export function pickString(
  lookup: Map<string, unknown>,
  aliases: string[],
): string | null {
  const v = pickRaw(lookup, aliases);
  return v == null ? null : String(v).trim();
}

export function parseBool(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return ["yes", "y", "true", "t", "x", "1", "epc prime"].includes(s);
}

export function splitList(v: string | null): string[] {
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
export function parseDate(v: unknown): string | null {
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
export function resolveTriggers(
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
export function parseAttendeeCell(value: string): {
  name: string;
  email: string | null;
} {
  const angle = /<([^>]+)>/.exec(value);
  const paren = /\(([^)]+@[^)]+)\)/.exec(value);
  const email = angle?.[1] ?? paren?.[1] ?? null;
  const name = value.replace(/<[^>]+>/, "").replace(/\([^)]+\)/, "").trim();
  return { name: name || value.trim(), email: email ? email.trim() : null };
}

export interface AttendeeRecord {
  name: string;
  email: string | null;
  role: string;
}

export function extractAttendees(
  lookup: Map<string, unknown>,
): AttendeeRecord[] {
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
export function hashRow(row: RawRow): string {
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

// True when a row has at least one non-blank cell (used to skip trailing
// blank lines without recording them as skipped/errored).
export function rowHasContent(lookup: Map<string, unknown>): boolean {
  return Array.from(lookup.values()).some(
    (v) => v != null && String(v).trim() !== "",
  );
}
