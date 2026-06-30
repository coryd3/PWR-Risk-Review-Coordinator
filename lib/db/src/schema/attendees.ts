import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";

export const attendeesTable = pgTable("attendees", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => riskReviewRequestsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  role: text("role").notNull(),
  attendeeType: text("attendee_type"),
  source: text("source"),
  isRequired: boolean("is_required").notNull().default(true),
});

export type AttendeeRow = typeof attendeesTable.$inferSelect;
export type InsertAttendee = typeof attendeesTable.$inferInsert;
