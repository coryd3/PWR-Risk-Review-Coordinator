import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => riskReviewRequestsTable.id, { onDelete: "cascade" }),
  meetingType: text("meeting_type").notNull(),
  targetDate: date("target_date", { mode: "string" }),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  timezone: text("timezone").default("America/Chicago"),
  subject: text("subject"),
  body: text("body"),
  teamsLink: text("teams_link"),
  outlookEventId: text("outlook_event_id"),
  status: text("status").notNull().default("Not Scheduled"),
  riskLead: text("risk_lead"),
  rescheduledCount: integer("rescheduled_count").notNull().default(0),
  notes: text("notes"),
});

export type MeetingRow = typeof meetingsTable.$inferSelect;
export type InsertMeeting = typeof meetingsTable.$inferInsert;
