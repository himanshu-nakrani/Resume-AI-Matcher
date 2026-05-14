import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const searchAlerts = sqliteTable("search_alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  query: text("query").notNull(),
  searchType: text("search_type").notNull().default("auto"),
  userLocation: text("user_location"),
  recentOnly: integer("recent_only", { mode: "boolean" }).default(false),
  filters: text("filters", { mode: "json" }),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  lastResultCount: integer("last_result_count"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
});

export type SearchAlert = typeof searchAlerts.$inferSelect;
export type SearchAlertInsert = typeof searchAlerts.$inferInsert;
