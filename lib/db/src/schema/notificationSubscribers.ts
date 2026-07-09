import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// People (or shared mailboxes) that receive an email notification when a new
// risk review request is submitted. Managed from the Admin console.
export const notificationSubscribersTable = pgTable("notification_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type NotificationSubscriberRow =
  typeof notificationSubscribersTable.$inferSelect;
export type InsertNotificationSubscriber =
  typeof notificationSubscribersTable.$inferInsert;
