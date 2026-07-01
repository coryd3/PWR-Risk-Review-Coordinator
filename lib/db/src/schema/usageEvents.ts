import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

// Usage-tracking events for measuring the solution's value ("First-Order
// Impact" = direct time saved). Each row captures a tracked action and enough
// raw parameters (program/addin/version/usage/username/usageUnit) to mirror the
// external UsageTracking API contract. minutesSaved is a stored snapshot
// (usageUnit * minutesPerUnit) so aggregations stay simple and stable even if
// the catalog's per-unit values change later.
export const usageEventsTable = pgTable("usage_events", {
  id: serial("id").primaryKey(),
  program: text("program").notNull(),
  addin: text("addin"),
  version: text("version"),
  usage: text("usage").notNull(),
  action: text("action").notNull(),
  username: text("username"),
  usageUnit: integer("usage_unit").notNull().default(1),
  minutesPerUnit: integer("minutes_per_unit").notNull().default(0),
  minutesSaved: integer("minutes_saved").notNull().default(0),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  source: text("source").notNull().default("app"),
  // 'disabled' | 'pending' | 'sent' | 'failed'
  forwardStatus: text("forward_status").notNull().default("disabled"),
  forwardError: text("forward_error"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UsageEventRow = typeof usageEventsTable.$inferSelect;
export type InsertUsageEvent = typeof usageEventsTable.$inferInsert;
