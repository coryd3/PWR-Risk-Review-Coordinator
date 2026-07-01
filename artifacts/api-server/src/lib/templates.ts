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
    requesterName: request.requesterName ?? "TBD",
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

export interface DraftRecipients {
  to: string;
  cc: string;
  from: string;
}

function recipientLabel(entry: { name: string; email: string }): string {
  return entry.email && entry.email.trim() !== "" ? entry.email : entry.name;
}

// Default To/CC/From for a generated draft. Pre-Risk drafts go to the coordinator
// AND the requester; Formal/Final (and other) drafts go to the coordinator only.
// Every draft is sent from the shared risk-review mailbox. All values remain
// editable by the coordinator before sending.
export function defaultRecipientsForType(
  templateType: string,
  request: RiskReviewRequestRow,
  routing: { mailbox: string; coordinator: { name: string; email: string } },
): DraftRecipients {
  const to: string[] = [recipientLabel(routing.coordinator)].filter(
    (v) => v && v.trim() !== "",
  );
  if (templateType.toLowerCase().includes("pre-risk")) {
    const requester =
      request.requesterEmail && request.requesterEmail.trim() !== ""
        ? request.requesterEmail
        : request.requesterName;
    if (requester && requester.trim() !== "") to.push(requester);
  }
  return { to: to.join("; "), cc: "", from: routing.mailbox };
}
