// Business rules service. All classification and validation logic lives here so
// it stays out of the React components and is the single source of truth.
import type {
  RiskReviewRequestRow,
  RiskTriggerRow,
  AttendeeRow,
} from "@workspace/db";
import {
  MAJOR_FEE_THRESHOLD_USD,
  MAJOR_DBB_TIC_THRESHOLD_USD,
  EPC_PRESIDENT_TIC_THRESHOLD_USD,
  FORMAL_FINAL_REQUIRED,
  FORMAL_FINAL_EPC_REQUIRED,
  FORMAL_FINAL_DBB_REQUIRED,
  FORMAL_FINAL_OPTIONAL,
  FORMAL_FINAL_MAJOR_OPTIONAL,
  FORMAL_FINAL_EPC_DBB_OPTIONAL,
  PRE_RISK_REQUIRED,
  PRE_RISK_EPC_DBB_REQUIRED,
  PRE_RISK_OPTIONAL,
  BUSINESS_LINE_DISTRIBUTIONS,
  type AttendeeRule,
} from "./constants";

export interface ValidationWarning {
  code: string;
  message: string;
}

// Delivery-method classification shared by Major logic and the attendee matrix.
export interface DeliveryClass {
  isEpc: boolean;
  isDbb: boolean;
  isProfessionalServices: boolean;
}

export function classifyDelivery(
  request: Pick<RiskReviewRequestRow, "deliveryMethod" | "isEpcPrime">,
): DeliveryClass {
  const method = (request.deliveryMethod ?? "").toLowerCase();
  const isEpc =
    Boolean(request.isEpcPrime) ||
    method.includes("epc") ||
    method.includes("design-build") ||
    method.includes("design build");
  const isDbb =
    method.includes("bid-build") ||
    method.includes("bid build") ||
    method.includes("dbb");
  const isProfessionalServices = method.includes("professional");
  return { isEpc, isDbb, isProfessionalServices };
}

// Major-opportunity classification (validated packet logic):
//   - Design-Build / EPC  with BMcD fee  > $10M  => Major
//   - Professional Services with BMcD fee > $10M => Major
//   - Design-Bid-Build (DBB) with Total Installed Cost > $50M => Major
// An explicitly Major-flagged risk trigger also forces Major, preserving the
// admin-configurable trigger override.
export function classifyMajor(
  request: Pick<
    RiskReviewRequestRow,
    | "deliveryMethod"
    | "isEpcPrime"
    | "bmcdContractValueNumeric"
    | "totalInstalledCostNumeric"
  >,
  triggers: Pick<RiskTriggerRow, "triggerNumber" | "isMajorOpportunityTrigger">[],
): boolean {
  const fee = request.bmcdContractValueNumeric ?? 0;
  const tic = request.totalInstalledCostNumeric ?? 0;
  const { isEpc, isDbb, isProfessionalServices } = classifyDelivery(request);

  if ((isEpc || isProfessionalServices) && fee > MAJOR_FEE_THRESHOLD_USD) {
    return true;
  }
  if (isDbb && tic > MAJOR_DBB_TIC_THRESHOLD_USD) {
    return true;
  }
  if (triggers.some((t) => t.isMajorOpportunityTrigger)) {
    return true;
  }
  return false;
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
  // Legal info missing is a warning, not a blocker: allow the request to proceed
  // as long as an explanation is provided.
  const legalExplanation = (request.legalMissingExplanation ?? "").trim();
  if ((attorneyMissing || rvwMissing) && legalExplanation === "") {
    warnings.push({
      code: "legal_missing_explanation_required",
      message:
        "Legal information is missing. Provide an explanation so the review can proceed.",
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
  const riskIdLower = riskId.toLowerCase();
  const riskIdExplanation = (request.riskIdentificationExplanation ?? "").trim();
  if (riskId === "") {
    warnings.push({
      code: "risk_identification_status",
      message: "Risk Identification Meeting status is blank.",
    });
  } else if (riskIdLower === "no" && riskIdExplanation === "") {
    warnings.push({
      code: "risk_identification_no_explanation",
      message:
        "Risk Identification is No. Provide an explanation of why one is not needed.",
    });
  } else if (riskIdLower === "scheduled" && !request.riskIdentificationDate) {
    warnings.push({
      code: "risk_identification_date_missing",
      message:
        "Risk Identification is Scheduled. Provide the scheduled date.",
    });
  } else if (riskIdLower === "other" && riskIdExplanation === "") {
    warnings.push({
      code: "risk_identification_other_explanation",
      message: "Risk Identification is Other. Provide an explanation.",
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

  const requiredRoles = getRequiredRoles(request);
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

// Which meeting stages a request needs, derived from its request type.
export function requestNeedsPreRisk(
  request: Pick<RiskReviewRequestRow, "requestType">,
): boolean {
  return (request.requestType ?? "").toLowerCase().includes("pre-risk");
}

export function requestNeedsFormalOrFinal(
  request: Pick<RiskReviewRequestRow, "requestType">,
): boolean {
  const t = (request.requestType ?? "").toLowerCase();
  return t.includes("formal risk") || t.includes("final risk");
}

// Dedupe attendee rules by role, keeping the first occurrence (so a required
// seat wins over a later optional/conditional seat for the same role).
function dedupeRules(rules: AttendeeRule[]): AttendeeRule[] {
  const seen = new Set<string>();
  const out: AttendeeRule[] = [];
  for (const rule of rules) {
    if (!seen.has(rule.role)) {
      seen.add(rule.role);
      out.push(rule);
    }
  }
  return out;
}

export interface AttendeeMatrix {
  required: AttendeeRule[];
  optional: AttendeeRule[];
  distributionEmails: string[];
}

// Assemble the full required/optional/distribution attendee set for a request
// from the validated packet matrix. Delivery method (EPC/DBB), Major status, and
// business line all shift the set.
export function computeAttendeeMatrix(
  request: Pick<
    RiskReviewRequestRow,
    | "requestType"
    | "deliveryMethod"
    | "isEpcPrime"
    | "isMajorOpportunity"
    | "totalInstalledCostNumeric"
    | "businessLines"
  >,
  triggers: Pick<RiskTriggerRow, "isMajorOpportunityTrigger">[] = [],
): AttendeeMatrix {
  const { isEpc, isDbb } = classifyDelivery(request);
  const needsPreRisk = requestNeedsPreRisk(request);
  const needsFormalOrFinal = requestNeedsFormalOrFinal(request);
  const isMajor =
    Boolean(request.isMajorOpportunity) ||
    triggers.some((t) => t.isMajorOpportunityTrigger);
  const tic = request.totalInstalledCostNumeric ?? 0;

  const lines = (request.businessLines ?? []).map((b) => b.toLowerCase());
  const hasSolar = lines.some((b) => b.includes("solar"));
  const hasBess = lines.some((b) => b.includes("bess"));

  const required: AttendeeRule[] = [];
  const optional: AttendeeRule[] = [];
  const distributionEmails: string[] = [];

  if (needsFormalOrFinal) {
    required.push(...FORMAL_FINAL_REQUIRED);
    if (isEpc) required.push(...FORMAL_FINAL_EPC_REQUIRED);
    if (isDbb) required.push(...FORMAL_FINAL_DBB_REQUIRED);

    optional.push(...FORMAL_FINAL_OPTIONAL);
    if (isMajor) optional.push(...FORMAL_FINAL_MAJOR_OPTIONAL);
    if (isEpc || isDbb) {
      for (const rule of FORMAL_FINAL_EPC_DBB_OPTIONAL) {
        if (rule.role === "President of Construction" && !(isEpc && tic > EPC_PRESIDENT_TIC_THRESHOLD_USD)) {
          continue;
        }
        // Facility Security Director and the alternate CDB Operations Executive
        // seat are EPC-only per the packet.
        if (rule.role === "Facility Security Director" && !isEpc) continue;
        if (rule.role === "CDB Operations Executive" && !isEpc) continue;
        optional.push(rule);
      }
      if (hasSolar) distributionEmails.push(BUSINESS_LINE_DISTRIBUTIONS.solarEpcDbb);
      if (hasBess) distributionEmails.push(BUSINESS_LINE_DISTRIBUTIONS.bessEpcDbb);
    }
  }

  if (needsPreRisk) {
    required.push(...PRE_RISK_REQUIRED);
    if (isEpc || isDbb) required.push(...PRE_RISK_EPC_DBB_REQUIRED);

    optional.push(...PRE_RISK_OPTIONAL);
    if (hasSolar) {
      if (!isEpc) distributionEmails.push(BUSINESS_LINE_DISTRIBUTIONS.solarNonEpc);
      if (isEpc || isDbb) distributionEmails.push(BUSINESS_LINE_DISTRIBUTIONS.solarEpcDbb);
    }
    if (hasBess) {
      if (!isEpc) distributionEmails.push(BUSINESS_LINE_DISTRIBUTIONS.bessNonEpc);
      if (isEpc || isDbb) distributionEmails.push(BUSINESS_LINE_DISTRIBUTIONS.bessEpcDbb);
    }
  }

  return {
    required: dedupeRules(required),
    optional: dedupeRules(optional),
    distributionEmails: [...new Set(distributionEmails)],
  };
}

// Mandatory roles (excluding "if applicable" conditionals) whose absence is
// flagged by computeWarnings. Assembled from the attendee matrix for the
// request's meeting stages and delivery method.
export function getRequiredRoles(
  request: Pick<
    RiskReviewRequestRow,
    | "requestType"
    | "deliveryMethod"
    | "isEpcPrime"
    | "isMajorOpportunity"
    | "totalInstalledCostNumeric"
    | "businessLines"
  >,
): string[] {
  return computeAttendeeMatrix(request)
    .required.filter((rule) => rule.note == null)
    .map((rule) => rule.role);
}
