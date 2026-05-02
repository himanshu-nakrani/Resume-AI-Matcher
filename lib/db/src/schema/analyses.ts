import { pgTable, serial, text, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  jobTitle: text("job_title").notNull(),
  companyName: text("company_name"),
  resumeText: text("resume_text").notNull(),
  jobDescriptionText: text("job_description_text").notNull(),
  fitScore: integer("fit_score").notNull(),
  fitRationale: text("fit_rationale").notNull(),
  strengths: json("strengths").$type<string[]>().notNull().default([]),
  gaps: json("gaps").$type<string[]>().notNull().default([]),
  improvements: json("improvements").$type<string[]>().notNull().default([]),
  atsKeywordsMatched: json("ats_keywords_matched").$type<string[]>().notNull().default([]),
  atsKeywordsMissing: json("ats_keywords_missing").$type<string[]>().notNull().default([]),
  atsScore: integer("ats_score").notNull(),
  coverLetter: text("cover_letter"),
  linkedinPost: text("linkedin_post"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
