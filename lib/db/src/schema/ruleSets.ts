import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";

export const ruleSetsTable = pgTable("rule_sets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  conditionJson: text("condition_json"),
  outputJson: text("output_json"),
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export type RuleSetRow = typeof ruleSetsTable.$inferSelect;
export type InsertRuleSet = typeof ruleSetsTable.$inferInsert;
