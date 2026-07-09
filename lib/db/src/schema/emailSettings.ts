import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Microsoft Graph service-principal settings used to send notification emails.
// Single-row table managed from the Admin console: the primary key is fixed at
// 1 and all writes are upserts against that row, so the singleton invariant is
// enforced at the database level. The client secret is write-only through the
// API: it is stored here but never returned to clients.
export const emailSettingsTable = pgTable("email_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(false),
  tenantId: text("tenant_id"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  senderAddress: text("sender_address"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type EmailSettingsRow = typeof emailSettingsTable.$inferSelect;
export type InsertEmailSettings = typeof emailSettingsTable.$inferInsert;
