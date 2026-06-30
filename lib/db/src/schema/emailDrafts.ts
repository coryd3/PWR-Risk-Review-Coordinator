import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";

export const emailDraftsTable = pgTable("email_drafts", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => riskReviewRequestsTable.id, { onDelete: "cascade" }),
  meetingId: integer("meeting_id"),
  templateId: integer("template_id"),
  templateType: text("template_type"),
  toRecipients: text("to_recipients").notNull().default(""),
  ccRecipients: text("cc_recipients").notNull().default(""),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export type EmailDraftRow = typeof emailDraftsTable.$inferSelect;
export type InsertEmailDraft = typeof emailDraftsTable.$inferInsert;
