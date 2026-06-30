// Maps Drizzle DB rows to API (OpenAPI) response shapes.
// Timestamp columns come back as Date objects; the API contract returns ISO
// strings, so we normalize here in one place.
import type {
  RiskReviewRequestRow,
  RiskTriggerRow,
  AttendeeRow,
  MeetingRow,
  EmailTemplateRow,
  EmailDraftRow,
  RuleSetRow,
  StatusHistoryRow,
  NoteRow,
} from "@workspace/db";
import type { ValidationWarning } from "./rules";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function mapRiskTrigger(row: RiskTriggerRow) {
  return {
    id: row.id,
    triggerNumber: row.triggerNumber,
    triggerName: row.triggerName,
    triggerDescription: row.triggerDescription,
    isMajorOpportunityTrigger: row.isMajorOpportunityTrigger,
    active: row.active,
  };
}

export function mapAttendee(row: AttendeeRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    name: row.name,
    email: row.email,
    role: row.role,
    attendeeType: row.attendeeType,
    source: row.source,
    isRequired: row.isRequired,
  };
}

export function mapMeeting(row: MeetingRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    meetingType: row.meetingType,
    targetDate: row.targetDate,
    scheduledStart: iso(row.scheduledStart),
    scheduledEnd: iso(row.scheduledEnd),
    timezone: row.timezone,
    subject: row.subject,
    body: row.body,
    teamsLink: row.teamsLink,
    outlookEventId: row.outlookEventId,
    status: row.status,
    riskLead: row.riskLead,
    rescheduledCount: row.rescheduledCount,
    notes: row.notes,
  };
}

export function mapMeetingWithRequest(
  row: MeetingRow,
  request: Pick<
    RiskReviewRequestRow,
    "projectName" | "clientName" | "crmOpportunityNumber"
  > | null,
  requiredAttendees: string[],
  optionalAttendees: string[],
) {
  return {
    ...mapMeeting(row),
    projectName: request?.projectName ?? null,
    clientName: request?.clientName ?? null,
    crmOpportunityNumber: request?.crmOpportunityNumber ?? null,
    requiredAttendees,
    optionalAttendees,
  };
}

export function mapEmailTemplate(row: EmailTemplateRow) {
  return {
    id: row.id,
    templateName: row.templateName,
    templateType: row.templateType,
    appliesToMajor: row.appliesToMajor,
    appliesToBusinessLine: row.appliesToBusinessLine,
    appliesToRequestType: row.appliesToRequestType,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    active: row.active,
  };
}

export function mapEmailDraft(row: EmailDraftRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    meetingId: row.meetingId,
    templateId: row.templateId,
    templateType: row.templateType,
    toRecipients: row.toRecipients,
    ccRecipients: row.ccRecipients,
    subject: row.subject,
    body: row.body,
    status: row.status,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    sentAt: iso(row.sentAt),
  };
}

export function mapRuleSet(row: RuleSetRow) {
  return {
    id: row.id,
    name: row.name,
    conditionJson: row.conditionJson,
    outputJson: row.outputJson,
    priority: row.priority,
    active: row.active,
  };
}

export function mapStatusHistory(row: StatusHistoryRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    changedBy: row.changedBy,
    changedAt: iso(row.changedAt),
    notes: row.notes,
  };
}

export function mapNote(row: NoteRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    noteText: row.noteText,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
  };
}

export function mapRequest(row: RiskReviewRequestRow) {
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    clientName: row.clientName,
    projectName: row.projectName,
    crmOpportunityNumber: row.crmOpportunityNumber,
    bmcdContractValueRaw: row.bmcdContractValueRaw,
    bmcdContractValueNumeric: row.bmcdContractValueNumeric,
    totalInstalledCostRaw: row.totalInstalledCostRaw,
    totalInstalledCostNumeric: row.totalInstalledCostNumeric,
    businessLines: row.businessLines ?? [],
    businessLineClassification: row.businessLineClassification,
    contractReviewRvwNumber: row.contractReviewRvwNumber,
    isEpcPrime: row.isEpcPrime,
    isMajorOpportunity: row.isMajorOpportunity,
    requestType: row.requestType,
    riskIdentificationStatus: row.riskIdentificationStatus,
    preRiskTargetDate: row.preRiskTargetDate,
    formalRiskTargetDate: row.formalRiskTargetDate,
    proposalDueDate: row.proposalDueDate,
    formalRiskDiscussionDate: row.formalRiskDiscussionDate,
    finalRiskTargetDate: row.finalRiskTargetDate,
    preRiskLead: row.preRiskLead,
    formalRiskLead: row.formalRiskLead,
    status: row.status,
    nextAction: row.nextAction,
    owner: row.owner,
    notes: row.notes,
  };
}

export function mapRequestDetail(
  row: RiskReviewRequestRow,
  triggers: RiskTriggerRow[],
  attendees: AttendeeRow[],
  meetings: MeetingRow[],
  warnings: ValidationWarning[],
) {
  return {
    ...mapRequest(row),
    triggers: triggers.map(mapRiskTrigger),
    attendees: attendees.map(mapAttendee),
    meetings: meetings.map(mapMeeting),
    warnings,
  };
}
