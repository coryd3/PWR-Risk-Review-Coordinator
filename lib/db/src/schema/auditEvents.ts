import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(),
  actor: text("actor"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditEventRow = typeof auditEventsTable.$inferSelect;
export type InsertAuditEvent = typeof auditEventsTable.$inferInsert;
