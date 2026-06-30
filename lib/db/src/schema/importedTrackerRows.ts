import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { riskReviewRequestsTable } from "./requests";

// Staging table for the legacy Excel tracker import (see scripts/import-tracker.ts).
// Each row of the source spreadsheet is staged here verbatim (as JSON in
// `sourceRow`) before being promoted into a risk_review_request. `rowHash` is a
// stable content hash used to make re-imports idempotent, and `requestId` links
// a staged row to the request it produced.
export const importedTrackerRowsTable = pgTable("imported_tracker_rows", {
  id: serial("id").primaryKey(),
  sourceFile: text("source_file"),
  rowNumber: integer("row_number"),
  rowHash: text("row_hash").notNull().unique(),
  sourceRow: text("source_row").notNull(),
  requestId: integer("request_id").references(
    () => riskReviewRequestsTable.id,
    { onDelete: "set null" },
  ),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processed: boolean("processed").notNull().default(false),
});

export type ImportedTrackerRow = typeof importedTrackerRowsTable.$inferSelect;
export type InsertImportedTrackerRow =
  typeof importedTrackerRowsTable.$inferInsert;
