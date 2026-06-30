import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => riskReviewRequestsTable.id, { onDelete: "cascade" }),
  noteText: text("note_text").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type NoteRow = typeof notesTable.$inferSelect;
export type InsertNote = typeof notesTable.$inferInsert;
