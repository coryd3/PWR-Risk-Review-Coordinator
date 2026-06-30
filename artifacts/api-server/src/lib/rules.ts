// Business rules service. All classification and validation logic lives here so
// it stays out of the React components and is the single source of truth.
import type {
  RiskReviewRequestRow,
  RiskTriggerRow,
  AttendeeRow,
} from "@workspace/db";

export interface ValidationWarning {
  code: string;
  message: string;
}

// A request is Major if the selected risk triggers include Trigger 1 or 2.
export function classifyMajor(triggers: Pick<RiskTriggerRow, "triggerNumber" | "isMajorOpportunityTrigger">[]): boolean {
  return triggers.some(
    (t) => t.isMajorOpportunityTrigger || t.triggerNumber === 1 || t.triggerNumber === 2,
  );
}

// Business line classification from the multi-select business lines.
export function classifyBusinessLine(businessLines: string[]): string {
  const has = (name: string) =>
    businessLines.some((b) => b.toLowerCase() === name.toLowerCase());
  const bess = has("BESS");
  const solar = has("Solar");
  const ghi = has("GHI");

  if (bess && solar) return "BESS + Solar";
  if (bess && !solar) return "BESS";
  if (solar && !bess) return "Solar";
  if (ghi && !bess && !solar) return "GHI";
  return "Other";
}

function hasNamedAttendee(attendees: AttendeeRow[], role: string): boolean {
  return attendees.some(
    (a) => a.role === role && a.name != null && a.name.trim() !== "",
  );
}

function isFormalRiskRequested(request: RiskReviewRequestRow): boolean {
  return (request.requestType ?? "").toLowerCase().includes("formal risk");
}

function isFinalRiskRequested(request: RiskReviewRequestRow): boolean {
  return (request.requestType ?? "").toLowerCase().includes("final risk");
}

// Non-blocking validation warnings shown on the request detail page.
export function computeWarnings(
  request: RiskReviewRequestRow,
  triggers: RiskTriggerRow[],
  attendees: AttendeeRow[],
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const attorneyMissing = !hasNamedAttendee(attendees, "Attorney");
  const rvwMissing =
    request.contractReviewRvwNumber == null ||
    request.contractReviewRvwNumber.trim() === "";

  if (attorneyMissing) {
    warnings.push({ code: "attorney_missing", message: "Attorney is missing." });
  }
  if (rvwMissing) {
    warnings.push({
      code: "rvw_missing",
      message: "Contract Review Request RVW # is missing.",
    });
  }
  if (isFormalRiskRequested(request) && (attorneyMissing || rvwMissing)) {
    warnings.push({
      code: "formal_risk_legal_incomplete",
      message: "Formal Risk is requested but legal information is incomplete.",
    });
  }
  if (isFinalRiskRequested(request) && !request.formalRiskDiscussionDate) {
    warnings.push({
      code: "final_risk_missing_formal_date",
      message:
        "Final Risk is requested but Formal Risk Discussion Date is missing.",
    });
  }

  const riskId = (request.riskIdentificationStatus ?? "").trim();
  if (riskId === "" || riskId.toLowerCase() === "no") {
    warnings.push({
      code: "risk_identification_status",
      message: "Risk Identification Meeting status is No or blank.",
    });
  }

  if (
    request.preRiskTargetDate &&
    request.formalRiskTargetDate &&
    request.preRiskTargetDate > request.formalRiskTargetDate
  ) {
    warnings.push({
      code: "prerisk_after_formal",
      message: "Pre-Risk target date is after Formal Risk target date.",
    });
  }

  if (
    request.proposalDueDate &&
    request.formalRiskTargetDate &&
    request.proposalDueDate < request.formalRiskTargetDate
  ) {
    warnings.push({
      code: "proposal_before_formal",
      message: "Proposal due date is before Formal Risk target date.",
    });
  }

  const requiredRoles = getRequiredRoles(request.isEpcPrime);
  const missingRoles = requiredRoles.filter(
    (role) => !hasNamedAttendee(attendees, role),
  );
  if (missingRoles.length > 0) {
    warnings.push({
      code: "required_attendees_missing",
      message: `Required attendees are missing: ${missingRoles.join(", ")}.`,
    });
  }

  if (triggers.length === 0) {
    warnings.push({
      code: "no_triggers",
      message: "Request has no risk triggers selected.",
    });
  }

  if (!request.businessLines || request.businessLines.length === 0) {
    warnings.push({
      code: "no_business_line",
      message: "Request has no business line selected.",
    });
  }

  return warnings;
}

// Required roles whose absence triggers a warning. Kept intentionally small
// (legal/lead roles). TODO: make configurable via static attendee rules.
function getRequiredRoles(isEpcPrime: boolean): string[] {
  if (isEpcPrime) {
    return ["Business-Line Director", "Project Manager", "Attorney"];
  }
  return ["Attorney"];
}
