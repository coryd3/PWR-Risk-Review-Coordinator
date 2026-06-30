import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const importedTrackerRowsTable = pgTable("imported_tracker_rows", {
  id: serial("id").primaryKey(),
  sourceRow: text("source_row").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processed: boolean("processed").notNull().default(false),
});

export type ImportedTrackerRow = typeof importedTrackerRowsTable.$inferSelect;
export type InsertImportedTrackerRow =
  typeof importedTrackerRowsTable.$inferInsert;
