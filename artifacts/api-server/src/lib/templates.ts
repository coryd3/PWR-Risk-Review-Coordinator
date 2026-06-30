// Email template rendering service. Uses simple {{variable}} placeholder
// substitution. Templates are stored in the email_templates table so they can be
// edited from Admin without code changes.
import type {
  RiskReviewRequestRow,
  RiskTriggerRow,
  AttendeeRow,
  EmailTemplateRow,
} from "@workspace/db";

export type TemplateContext = Record<string, string>;

function fmtDate(value: string | null): string {
  return value ?? "TBD";
}

function fmtValue(raw: string | null, numeric: number | null): string {
  if (raw && raw.trim() !== "") return raw;
  if (numeric != null) return `$${numeric.toLocaleString("en-US")}`;
  return "TBD";
}

function attendeeNames(attendees: AttendeeRow[], required: boolean): string {
  const names = attendees
    .filter((a) => a.isRequired === required)
    .map((a) => {
      const role = a.role ? ` (${a.role})` : "";
      return a.name ? `${a.name}${role}` : a.role;
    })
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(", ") : "TBD";
}

export function buildTemplateContext(
  request: RiskReviewRequestRow,
  triggers: RiskTriggerRow[],
  attendees: AttendeeRow[],
  extra: Partial<TemplateContext> = {},
): TemplateContext {
  return {
    projectName: request.projectName ?? "TBD",
    clientName: request.clientName ?? "TBD",
    crmOpportunityNumber: request.crmOpportunityNumber ?? "TBD",
    riskTriggers:
      triggers.length > 0
        ? triggers.map((t) => `${t.triggerNumber}. ${t.triggerName}`).join("; ")
        : "None selected",
    bmcdContractValue: fmtValue(
      request.bmcdContractValueRaw,
      request.bmcdContractValueNumeric,
    ),
    totalInstalledCost: fmtValue(
      request.totalInstalledCostRaw,
      request.totalInstalledCostNumeric,
    ),
    businessLine:
      request.businessLineClassification ??
      (request.businessLines ?? []).join(", ") ??
      "TBD",
    requiredAttendees: attendeeNames(attendees, true),
    optionalAttendees: attendeeNames(attendees, false),
    preRiskTargetDate: fmtDate(request.preRiskTargetDate),
    formalRiskTargetDate: fmtDate(request.formalRiskTargetDate),
    proposalDueDate: fmtDate(request.proposalDueDate),
    formalRiskDiscussionDate: fmtDate(request.formalRiskDiscussionDate),
    finalRiskTargetDate: fmtDate(request.finalRiskTargetDate),
    riskLead: request.preRiskLead ?? request.formalRiskLead ?? "TBD",
    preRiskLead: request.preRiskLead ?? "TBD",
    formalRiskLead: request.formalRiskLead ?? "TBD",
    otherComments: request.notes ?? "",
    riskIdentificationStatus: request.riskIdentificationStatus ?? "TBD",
    ...extra,
  };
}

// Replaces {{key}} placeholders. Unknown placeholders are left intact so they
// are visible to the coordinator who can edit the draft.
export function renderString(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(context, key)
      ? context[key]
      : match;
  });
}

export function renderTemplate(
  template: EmailTemplateRow,
  context: TemplateContext,
): { subject: string; body: string } {
  return {
    subject: renderString(template.subjectTemplate ?? "", context),
    body: renderString(template.bodyTemplate ?? "", context),
  };
}

// Default template types generated for a request based on its request type.
export function defaultTemplateTypesForRequest(
  request: RiskReviewRequestRow,
): string[] {
  const type = (request.requestType ?? "").toLowerCase();
  if (type.includes("final risk")) {
    return ["Final Risk Review Request"];
  }
  return ["Pre-Risk / Risk Review Request", "Formal Risk Request"];
}
