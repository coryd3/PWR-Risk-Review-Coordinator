import {
  pgTable,
  serial,
  text,
  boolean,
  doublePrecision,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

export const riskReviewRequestsTable = pgTable("risk_review_requests", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  requesterName: text("requester_name"),
  requesterEmail: text("requester_email"),
  clientName: text("client_name"),
  projectName: text("project_name"),
  crmOpportunityNumber: text("crm_opportunity_number"),
  bmcdContractValueRaw: text("bmcd_contract_value_raw"),
  bmcdContractValueNumeric: doublePrecision("bmcd_contract_value_numeric"),
  totalInstalledCostRaw: text("total_installed_cost_raw"),
  totalInstalledCostNumeric: doublePrecision("total_installed_cost_numeric"),
  businessLines: text("business_lines").array().notNull().default([]),
  businessLineClassification: text("business_line_classification"),
  contractReviewRvwNumber: text("contract_review_rvw_number"),
  deliveryMethod: text("delivery_method"),
  region: text("region"),
  legalMissingExplanation: text("legal_missing_explanation"),
  isEpcPrime: boolean("is_epc_prime").notNull().default(false),
  isMajorOpportunity: boolean("is_major_opportunity").notNull().default(false),
  requestType: text("request_type"),
  riskIdentificationStatus: text("risk_identification_status"),
  riskIdentificationDate: date("risk_identification_date", { mode: "string" }),
  riskIdentificationExplanation: text("risk_identification_explanation"),
  preRiskTargetDate: date("pre_risk_target_date", { mode: "string" }),
  formalRiskTargetDate: date("formal_risk_target_date", { mode: "string" }),
  proposalDueDate: date("proposal_due_date", { mode: "string" }),
  formalRiskDiscussionDate: date("formal_risk_discussion_date", {
    mode: "string",
  }),
  finalRiskTargetDate: date("final_risk_target_date", { mode: "string" }),
  preRiskLead: text("pre_risk_lead"),
  formalRiskLead: text("formal_risk_lead"),
  status: text("status").notNull().default("New"),
  nextAction: text("next_action"),
  owner: text("owner"),
  notes: text("notes"),
});

export type RiskReviewRequestRow = typeof riskReviewRequestsTable.$inferSelect;
export type InsertRiskReviewRequest =
  typeof riskReviewRequestsTable.$inferInsert;
