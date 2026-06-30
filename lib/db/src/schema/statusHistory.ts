import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";

export const statusHistoryTable = pgTable("status_history", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => riskReviewRequestsTable.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  changedBy: text("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

export type StatusHistoryRow = typeof statusHistoryTable.$inferSelect;
export type InsertStatusHistory = typeof statusHistoryTable.$inferInsert;
