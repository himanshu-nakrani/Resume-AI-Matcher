import { db, analyses } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const SAMPLE_RESUME = `Jane Smith
Senior Frontend Engineer | San Francisco, CA
jane@example.com · linkedin.com/in/janesmith

EXPERIENCE
Senior Frontend Engineer · Lyft · 2022-Present
- Led migration from Redux to TanStack Query across 18 product surfaces, cutting bundle size 22% and reducing average page TTI from 2.1s to 1.4s
- Built design-system primitives (Button, Modal, Combobox) shipped across 3 product teams; adopted by 40+ engineers
- Owned web-vitals dashboard; drove p75 LCP from 3.2s to 1.8s through code-splitting and image-CDN strategy

Frontend Engineer · Coinbase · 2019-2022
- Shipped onboarding redesign that lifted account-creation completion 9 percentage points
- Authored team's React + TypeScript style guide; ran weekly code-review office hours

EDUCATION
B.S. Computer Science · UC Berkeley · 2019

SKILLS
React · TypeScript · Next.js · TanStack Query · Tailwind · Vite · Playwright · Storybook · GraphQL · Node`;

const SAMPLE_JD = `Senior Frontend Engineer at Stripe — Payments Platform

We're hiring a Senior Frontend Engineer to join the Payments Platform team. You will own complex, high-stakes user flows that move billions of dollars annually.

What you'll do:
- Build production React + TypeScript surfaces in our internal design system
- Drive performance: Core Web Vitals, bundle size, perceived latency
- Partner with design and product to prototype, ship, and iterate on payment flows
- Mentor mid-level engineers; raise the bar through code review and tech-spec authorship

What we're looking for:
- 5+ years of production React and TypeScript
- Deep experience with state management at scale (Redux, TanStack Query, etc.)
- Strong opinions on accessibility, performance, and testability
- Familiarity with one of: Next.js, Remix, Vite
- Bonus: GraphQL, Playwright, design-system authoring`;

export function seedSampleAnalysisIfEmpty(): void {
  try {
    const result = db.select({ count: sql<number>`COUNT(*)` }).from(analyses).all();
    const count = result[0]?.count ?? 0;
    if (count > 0) return;

    db.insert(analyses).values({
      jobTitle: "Senior Frontend Engineer",
      companyName: "Stripe",
      resumeText: SAMPLE_RESUME,
      originalFileName: "jane_smith_resume.pdf",
      originalFileType: "text",
      jobDescriptionText: SAMPLE_JD,
      fitScore: 87,
      fitRationale:
        "Strong overlap on React + TypeScript at scale, performance focus, and design-system experience. Lyft tenure demonstrates production React + TanStack Query depth that maps directly to the role's stated stack.",
      strengths: [
        "5+ years production React + TypeScript at scale (Lyft, Coinbase)",
        "Documented Core Web Vitals impact (LCP 3.2s → 1.8s)",
        "Design-system primitive ownership adopted by 40+ engineers",
        "Onboarding redesign with measurable conversion lift",
      ],
      gaps: [
        "No explicit GraphQL production experience",
        "No mention of Playwright (listed as bonus)",
        "Next.js / Remix experience not on resume",
      ],
      improvements: [
        "Add the bundle-size reduction (22%) to the resume summary line — it's the highest-impact metric and currently buried in a bullet.",
        "If you have any Playwright or Cypress E2E experience, add a line under Lyft.",
        "Quantify the design-system adoption (\"used by 40+ engineers across 3 teams\") in the summary, not just the bullet.",
      ],
      atsKeywordsMatched: [
        "React",
        "TypeScript",
        "TanStack Query",
        "design system",
        "Core Web Vitals",
        "performance",
        "code review",
      ],
      atsKeywordsMissing: ["Stripe", "GraphQL", "Playwright", "Next.js", "Remix"],
      atsScore: 78,
      status: "not_applied",
      isFavorite: false,
      isPublic: false,
      tags: ["sample", "frontend"],
      portfolioLinks: [],
    }).run();

    logger.info("Seeded sample analysis for first-run experience");
  } catch (err) {
    logger.warn({ err }, "Failed to seed sample analysis; continuing");
  }
}
