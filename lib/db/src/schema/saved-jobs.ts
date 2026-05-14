import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const savedJobs = sqliteTable("saved_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  company: text("company"),
  source: text("source"),
  publishedDate: text("published_date"),
  highlights: text("highlights", { mode: "json" }).$type<string[]>(),
  salary: text("salary"),
  applyType: text("apply_type").$type<"ats" | "external" | "unknown">().default("unknown"),
  notes: text("notes"),
  savedAt: integer("saved_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
});

export type SavedJob = typeof savedJobs.$inferSelect;
export type SavedJobInsert = typeof savedJobs.$inferInsert;
