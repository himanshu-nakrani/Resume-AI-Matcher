import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { analyses } from "./analyses";

export type NotificationType = "deadline" | "follow_up" | "info";

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").$type<NotificationType>().notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  analysisId: integer("analysis_id").references(() => analyses.id, { onDelete: "cascade" }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
