/**
 * tracker-plan.ts — Pure, DB-free decision logic for one tracker row.
 *
 * `planRow` decides what should happen to a single source row (skip with a
 * reason, import with a fully-normalized payload, or ignore a blank row) and
 * builds the request/attendee/meeting payload. It performs NO writes: database
 * lookups required for the idempotency and CRM-duplicate guards are supplied
 * through the injected `PlanDeps`, so the whole decision path can be tested
 * with in-memory fakes. scripts/import-tracker.ts wires the real database in
 * and performs the inserts dictated by the returned plan.
 */
import type { RiskTriggerRow } from "@workspace/db";
import {
  FIELD_ALIASES,
  buildLookup,
  classifyBusinessLine,
  classifyMajor,
  collectDateProblems,
  extractAttendees,
  missingRequiredAttendeeRoles,
  parseBool,
  parseDate,
  parseMoney,
  pickRaw,
  pickString,
  resolveTriggers,
  rowHasContent,
  splitList,
  hashRow,
  type AttendeeRecord,
  type RawRow,
} from "./tracker-normalize";

export interface PlannedMeeting {
  meetingType: string;
  targetDate: string;
  riskLead: string | null;
}

function buildRequestValues(
  lookup: Map<string, unknown>,
  matched: RiskTriggerRow[],
  projectName: string | null,
  crm: string | null,
) {
  const businessLines = splitList(
    pickString(lookup, FIELD_ALIASES.businessLines),
  );
  const bmcdRaw = pickString(lookup, FIELD_ALIASES.bmcdContractValueRaw);
  const ticRaw = pickString(lookup, FIELD_ALIASES.totalInstalledCostRaw);

  return {
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
    requestType: pickString(lookup, FIELD_ALIASES.requestType),
    riskIdentificationStatus: pickString(
      lookup,
      FIELD_ALIASES.riskIdentificationStatus,
    ),
    preRiskTargetDate: parseDate(
      pickRaw(lookup, FIELD_ALIASES.preRiskTargetDate),
    ),
    formalRiskTargetDate: parseDate(
      pickRaw(lookup, FIELD_ALIASES.formalRiskTargetDate),
    ),
    proposalDueDate: parseDate(pickRaw(lookup, FIELD_ALIASES.proposalDueDate)),
    formalRiskDiscussionDate: parseDate(
      pickRaw(lookup, FIELD_ALIASES.formalRiskDiscussionDate),
    ),
    finalRiskTargetDate: parseDate(
      pickRaw(lookup, FIELD_ALIASES.finalRiskTargetDate),
    ),
    preRiskLead: pickString(lookup, FIELD_ALIASES.preRiskLead),
    formalRiskLead: pickString(lookup, FIELD_ALIASES.formalRiskLead),
    status: pickString(lookup, FIELD_ALIASES.status) ?? "New",
    nextAction: pickString(lookup, FIELD_ALIASES.nextAction),
    owner: pickString(lookup, FIELD_ALIASES.owner),
    notes: pickString(lookup, FIELD_ALIASES.notes),
  };
}

export type RequestValues = ReturnType<typeof buildRequestValues>;

export interface PlannedImport {
  requestValues: RequestValues;
  matched: RiskTriggerRow[];
  unmatched: string[];
  attendees: AttendeeRecord[];
  meetings: PlannedMeeting[];
  finalNotes: string | null;
  noteSuffix: string | null;
  // Non-blocking, plain-language advisories about this row (unrecognized risk
  // triggers, missing required attendee roles, no client name). The row still
  // imports; these tell the coordinator what to double-check in the source.
  warnings: string[];
}

export type PlanResult =
  | { kind: "empty" }
  | {
      kind: "skip";
      label: string;
      rowHash: string;
      reason: string;
      // Whether the skipped row should still be staged in
      // imported_tracker_rows. A row skipped because it was *already* imported
      // is already staged, so it is not re-staged.
      stage: boolean;
    }
  | {
      // A row that can't be imported because of a data problem the coordinator
      // must fix in the source file (e.g. an unparseable date). Unlike a skip,
      // this counts as an error so it's surfaced prominently for correction.
      kind: "error";
      label: string;
      rowHash: string;
      reason: string;
      stage: boolean;
    }
  | {
      kind: "import";
      label: string;
      rowHash: string;
      payload: PlannedImport;
    };

export interface PlanDeps {
  // Returns the staged row for a content hash, if one exists.
  getStagedByHash(
    hash: string,
  ): Promise<{ processed: boolean; requestId: number | null } | undefined>;
  // Returns the id of an existing request for a CRM opportunity number, if any.
  getRequestIdByCrm(crm: string): Promise<number | undefined>;
}

function buildMeetings(
  values: RequestValues,
): PlannedMeeting[] {
  const meetings: PlannedMeeting[] = [];
  if (values.preRiskTargetDate)
    meetings.push({
      meetingType: "Pre-Risk",
      targetDate: values.preRiskTargetDate,
      riskLead: values.preRiskLead,
    });
  if (values.formalRiskTargetDate)
    meetings.push({
      meetingType: "Formal Risk",
      targetDate: values.formalRiskTargetDate,
      riskLead: values.formalRiskLead,
    });
  if (values.finalRiskTargetDate)
    meetings.push({
      meetingType: "Final Risk",
      targetDate: values.finalRiskTargetDate,
      riskLead: values.formalRiskLead ?? values.preRiskLead,
    });
  return meetings;
}

// Decide the fate of a single source row. Pure aside from the injected lookups.
export async function planRow(
  row: RawRow,
  rowNumber: number,
  triggers: RiskTriggerRow[],
  deps: PlanDeps,
): Promise<PlanResult> {
  const lookup = buildLookup(row);

  const projectName = pickString(lookup, FIELD_ALIASES.projectName);
  const crm = pickString(lookup, FIELD_ALIASES.crmOpportunityNumber);
  const label = projectName ?? crm ?? `row ${rowNumber}`;

  // Skip fully-empty rows (trailing blank lines etc.) without recording them.
  if (!rowHasContent(lookup)) {
    return { kind: "empty" };
  }

  const rowHash = hashRow(row);

  // Idempotency: a row already promoted (same content hash) is skipped.
  const prior = await deps.getStagedByHash(rowHash);
  if (prior && prior.processed && prior.requestId != null) {
    return {
      kind: "skip",
      label,
      rowHash,
      reason: "already imported (row unchanged)",
      stage: false,
    };
  }

  // Minimum identity required to create a meaningful request.
  if (!projectName && !crm) {
    return {
      kind: "skip",
      label,
      rowHash,
      reason:
        "missing both Project Name and CRM Opportunity Number — a row needs at least one to become a request",
      stage: true,
    };
  }

  // Never create a duplicate request for an existing CRM opportunity.
  if (crm) {
    const dupId = await deps.getRequestIdByCrm(crm);
    if (dupId != null) {
      return {
        kind: "skip",
        label,
        rowHash,
        reason: `request already exists for CRM ${crm} (id ${dupId})`,
        stage: true,
      };
    }
  }

  // Unparseable date cells block the row: importing would silently drop the
  // date (and any meeting derived from it), so we surface a fixable error
  // instead of a silent fallback.
  const dateProblems = collectDateProblems(lookup);
  if (dateProblems.length > 0) {
    return {
      kind: "error",
      label,
      rowHash,
      reason: dateProblems.join("; "),
      stage: true,
    };
  }

  const { matched, unmatched } = resolveTriggers(
    pickString(lookup, FIELD_ALIASES.riskTriggers),
    triggers,
  );
  const requestValues = buildRequestValues(lookup, matched, projectName, crm);
  const attendees = extractAttendees(lookup);
  const meetings = buildMeetings(requestValues);

  const noteSuffix =
    unmatched.length > 0
      ? `Unmatched risk triggers from import: ${unmatched.join(", ")}.`
      : null;
  const finalNotes =
    noteSuffix && requestValues.notes
      ? `${requestValues.notes}\n${noteSuffix}`
      : (requestValues.notes ?? noteSuffix);

  // Non-blocking advisories the coordinator should double-check. The row still
  // imports; these just make terse/technical outcomes human-readable.
  const warnings: string[] = [];
  if (unmatched.length > 0) {
    warnings.push(
      `Unrecognized risk trigger(s): ${unmatched.join(", ")} — imported without them. Check the trigger numbers/names against the risk trigger list.`,
    );
  }
  const missingRoles = missingRequiredAttendeeRoles(attendees);
  if (missingRoles.length > 0) {
    warnings.push(
      `Missing required attendee role(s): ${missingRoles.join(", ")}.`,
    );
  }
  if (!requestValues.clientName) {
    warnings.push("No Client Name provided.");
  }

  return {
    kind: "import",
    label,
    rowHash,
    payload: {
      requestValues,
      matched,
      unmatched,
      attendees,
      meetings,
      finalNotes,
      noteSuffix,
      warnings,
    },
  };
}
