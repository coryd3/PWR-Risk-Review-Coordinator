import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";

export const riskTriggersTable = pgTable("risk_triggers", {
  id: serial("id").primaryKey(),
  triggerNumber: integer("trigger_number").notNull(),
  triggerName: text("trigger_name").notNull(),
  triggerDescription: text("trigger_description"),
  isMajorOpportunityTrigger: boolean("is_major_opportunity_trigger")
    .notNull()
    .default(false),
  active: boolean("active").notNull().default(true),
});

export type RiskTriggerRow = typeof riskTriggersTable.$inferSelect;
export type InsertRiskTrigger = typeof riskTriggersTable.$inferInsert;
