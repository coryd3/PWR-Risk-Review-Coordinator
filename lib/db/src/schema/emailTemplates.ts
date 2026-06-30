import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  templateName: text("template_name").notNull(),
  templateType: text("template_type").notNull(),
  appliesToMajor: boolean("applies_to_major"),
  appliesToBusinessLine: text("applies_to_business_line"),
  appliesToRequestType: text("applies_to_request_type"),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  active: boolean("active").notNull().default(true),
});

export type EmailTemplateRow = typeof emailTemplatesTable.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplatesTable.$inferInsert;
