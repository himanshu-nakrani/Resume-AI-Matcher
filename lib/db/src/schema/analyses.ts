import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const APPLICATION_STATUSES = ["not_applied", "applied", "got_interview", "got_online_exam", "selected", "rejected"] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

export type LearningResource = {
  title: string;
  type: "course" | "certification" | "project" | "book" | "article";
  description: string;
  platform?: string;
};

export type LearningPlanItem = {
  skill: string;
  why: string;
  priority: "high" | "medium" | "low";
  resources: LearningResource[];
};

export type SalaryRange = {
  low: number;
  mid: number;
  high: number;
  currency: string;
  period: "year" | "month" | "hour";
  context: string;
  factors: string[];
  negotiationTips: string[];
};

export type CompanyResearch = {
  overview: string;
  culture: string;
  interviewProcess: string;
  recentNews: string[];
  glassdoorRating: string;
  tips: string[];
};

export type RedFlag = {
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  quote: string;
};

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
  interviewQuestions: text("interview_questions", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  learningPlan: text("learning_plan", { mode: "json" }).$type<LearningPlanItem[]>().notNull().$defaultFn(() => []),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  shareToken: text("share_token"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  deadline: text("deadline"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  followUpDate: text("follow_up_date"),
  salaryGuide: text("salary_guide", { mode: "json" }).$type<SalaryRange>(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  companyResearch: text("company_research", { mode: "json" }).$type<CompanyResearch>(),
  redFlags: text("red_flags", { mode: "json" }).$type<RedFlag[]>(),
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
