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
  extractAttendees,
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
      reason: "missing both Project Name and CRM Opportunity Number",
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
    },
  };
}
