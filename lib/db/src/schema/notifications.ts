import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { analyses } from "./analyses";

export type NotificationType = "deadline" | "follow_up" | "info";

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").$type<NotificationType>().notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  analysisId: integer("analysis_id").references(() => analyses.id, { onDelete: "cascade" }),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type Notification = typeof notifications.$inferSelect;
