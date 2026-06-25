import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const APPLICATION_STATUSES = ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

export const analyses = sqliteTable("analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobTitle: text("job_title").notNull(),
  companyName: text("company_name"),
  resumeText: text("resume_text").notNull(),
  originalFileName: text("original_file_name"),
  originalFileType: text("original_file_type").$type<"pdf" | "latex" | "text">().notNull().default("text"),
  sourceLatex: text("source_latex"),
  optimizedLatex: text("optimized_latex"),
  jobDescriptionText: text("job_description_text").notNull(),
  fitScore: integer("fit_score").notNull(),
  fitRationale: text("fit_rationale").notNull(),
  strengths: text("strengths", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  gaps: text("gaps", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  improvements: text("improvements", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  atsKeywordsMatched: text("ats_keywords_matched", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  atsKeywordsMissing: text("ats_keywords_missing", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  atsScore: integer("ats_score").notNull(),
  coverLetter: text("cover_letter"),
  linkedinPost: text("linkedin_post"),
  status: text("status").$type<ApplicationStatus>().notNull().default("not_applied"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  shareToken: text("share_token"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  deadline: text("deadline"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  followUpDate: text("follow_up_date"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  portfolioLinks: text("portfolio_links", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  versionLabel: text("version_label"),
  location: text("location"),
  salaryExpectation: text("salary_expectation"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
