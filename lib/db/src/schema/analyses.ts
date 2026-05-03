import { pgTable, serial, text, integer, timestamp, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const APPLICATION_STATUSES = ["not_applied", "applied", "interview", "offer", "rejected"] as const;
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
  status: text("status").$type<ApplicationStatus>().notNull().default("not_applied"),
  interviewQuestions: json("interview_questions").$type<string[]>().notNull().default([]),
  learningPlan: json("learning_plan").$type<LearningPlanItem[]>().notNull().default([]),
  isFavorite: boolean("is_favorite").notNull().default(false),
  notes: text("notes"),
  shareToken: text("share_token"),
  isPublic: boolean("is_public").notNull().default(false),
  deadline: text("deadline"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  followUpDate: text("follow_up_date"),
  salaryGuide: json("salary_guide").$type<SalaryRange>(),
  tags: json("tags").$type<string[]>().notNull().default([]),
  companyResearch: json("company_research").$type<CompanyResearch>(),
  redFlags: json("red_flags").$type<RedFlag[]>(),
  portfolioLinks: json("portfolio_links").$type<string[]>().notNull().default([]),
  versionLabel: text("version_label"),
  location: text("location"),
  salaryExpectation: text("salary_expectation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
