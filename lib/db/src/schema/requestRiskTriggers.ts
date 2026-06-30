import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";
import { riskTriggersTable } from "./riskTriggers";

export const requestRiskTriggersTable = pgTable("request_risk_triggers", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => riskReviewRequestsTable.id, { onDelete: "cascade" }),
  triggerId: integer("trigger_id")
    .notNull()
    .references(() => riskTriggersTable.id, { onDelete: "cascade" }),
});

export type RequestRiskTriggerRow =
  typeof requestRiskTriggersTable.$inferSelect;
export type InsertRequestRiskTrigger =
  typeof requestRiskTriggersTable.$inferInsert;
