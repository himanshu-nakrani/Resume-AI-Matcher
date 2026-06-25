# Remove Interview Prep & Career Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove README feature sections 3 (Interview Preparation) and 4 (Career Development), plus the adjacent `predict-offer` endpoint, end-to-end: OpenAPI spec, generated client, DB schema, API server routes, frontend components/pages/nav, and README.

**Architecture:** Single-PR surgical removal. Work flows source-of-truth-first (OpenAPI → codegen → DB schema → API routes → frontend → README). Each layer is typechecked before moving on, so the repo stays internally consistent at every checkpoint.

**Tech Stack:** pnpm workspace monorepo · OpenAPI 3.1 + Orval codegen · Drizzle ORM + better-sqlite3 (`drizzle-kit push`) · Express 5 API · React + Vite frontend · TypeScript everywhere.

**Spec:** [`docs/superpowers/specs/2026-06-25-remove-interview-prep-and-career-dev-design.md`](../specs/2026-06-25-remove-interview-prep-and-career-dev-design.md)

---

## Background for the implementing engineer

This repo is a pnpm workspace with two source-of-truth artifacts that generate downstream code:

1. **`lib/api-spec/openapi.yaml`** — OpenAPI spec. Running `pnpm --filter @workspace/api-spec run codegen` runs Orval, which writes:
   - `lib/api-zod/src/generated/api.ts` (and `types/*.ts`) — Zod schemas + TS types
   - `lib/api-client-react/src/generated/api.ts` — React Query hooks
   - then runs `pnpm -w run typecheck:libs`
2. **`lib/db/src/schema/analyses.ts`** — Drizzle schema. `pnpm --filter @workspace/db run push` applies the schema directly to the local SQLite file at the repo root (`resume-matcher.sqlite`). There are no migration files; `drizzle-kit push` interactively diffs and applies.

The Express server at `artifacts/api-server/src/routes/analyses.ts` imports request/response schemas from `@workspace/api-zod`. The React app at `artifacts/resume-matcher/src/` imports hooks from `@workspace/api-client-react`.

**Type checking commands:**
- Per-package: `pnpm --filter @workspace/<name> run typecheck`
- Whole repo: `pnpm run typecheck` (runs `typecheck:libs` + each artifact's typecheck)

**Important constraints:**
- Do NOT keep deprecated fields, fallback shims, or backwards-compat code. Delete cleanly.
- DB column data loss is acceptable.
- Commit after each task. Use Conventional Commits (`refactor:`, `chore:`, `feat:`).

---

## File Map

### Files to delete entirely

```
artifacts/resume-matcher/src/components/interview-practice.tsx
artifacts/resume-matcher/src/components/mock-interview.tsx
artifacts/resume-matcher/src/components/market-insights.tsx
artifacts/resume-matcher/src/components/career-path.tsx
artifacts/resume-matcher/src/components/negotiation-calculator.tsx
artifacts/resume-matcher/src/components/follow-up-email.tsx
artifacts/resume-matcher/src/components/predictive-analytics.tsx
artifacts/resume-matcher/src/pages/skills.tsx
```

### Files to modify

```
lib/api-spec/openapi.yaml                                — remove paths + schemas + fields
lib/db/src/schema/analyses.ts                            — drop 5 columns + 5 exported types
artifacts/api-server/src/routes/analyses.ts              — remove 13 routes + imports
artifacts/resume-matcher/src/App.tsx                     — remove /skills route + import
artifacts/resume-matcher/src/components/layout.tsx       — remove nav links
artifacts/resume-matcher/src/components/command-palette.tsx  — remove command entries
artifacts/resume-matcher/src/pages/analysis.tsx          — remove 9 sections + mounts + imports + locals
artifacts/resume-matcher/src/pages/stats.tsx             — remove salary aggregation block
README.md                                                — delete "Interview Preparation" and "Career Development" sections
```

### Files regenerated (do not edit by hand)

```
lib/api-zod/src/generated/**
lib/api-client-react/src/generated/**
```

---

## Task 1: Edit OpenAPI spec — remove paths

**Files:**
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Open the spec and remove the following path blocks**

Delete the entire YAML block (path key + nested operations) for each of these. Use the line ranges from the current file (verify before editing — grep for each path key to confirm). After each delete, the surrounding indentation must remain valid.

Paths to delete (under top-level `paths:`):
- `/analyses/{id}/salary-guide`
- `/analyses/{id}/company-research`
- `/analyses/{id}/red-flags`
- `/analyses/{id}/negotiate`
- `/analyses/{id}/star-answer`
- `/analyses/{id}/learning-plan`
- `/analyses/{id}/interview-questions`
- `/analyses/{id}/market-insights`
- `/analyses/{id}/career-path`
- `/analyses/{id}/follow-up-email`
- `/analyses/{id}/predict-offer`
- `/analyses/{id}/mock-interview`
- `/analyses/{id}/practice-feedback`

Approach: open the file in an editor, search for each path key, and delete from that key up to (but not including) the next sibling path key at the same indentation level.

- [ ] **Step 2: Verify with grep**

Run:
```bash
grep -E "/analyses/\{id\}/(salary-guide|company-research|red-flags|negotiate|star-answer|learning-plan|interview-questions|market-insights|career-path|follow-up-email|predict-offer|mock-interview|practice-feedback)" lib/api-spec/openapi.yaml
```
Expected: no output.

- [ ] **Step 3: Do NOT commit yet** — Tasks 1, 2, and 3 are committed together after codegen (Task 4) so generated artifacts stay consistent.

---

## Task 2: Edit OpenAPI spec — remove component schemas

**Files:**
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Delete the following component schemas**

Under `components.schemas`, delete each schema (the key + its full nested body). These are the response/request/type schemas tied to the removed endpoints:

```
SalaryRange
SalaryGuideResponse
CompanyResearch
CompanyResearchResponse
RedFlag
RedFlagsResponse
NegotiateBody
ChatMessage
NegotiateResponse
StarAnswerBody
StarAnswerResponse
LearningResource
LearningPlanItem
LearningPlanResponse
InterviewQuestionsResponse
MarketInsightsResponse
CareerPathStep
CareerPathResponse
FollowUpEmailBody
FollowUpEmailResponse
PracticeFeedbackBody
PracticeFeedbackResponse
PredictOfferResponse
MockInterviewBody
MockInterviewResponse
```

For each: find the schema name at 4-space indentation under `components: schemas:`, delete from that line down to the next sibling schema name.

- [ ] **Step 2: Verify with grep**

Run:
```bash
grep -nE "^    (SalaryRange|SalaryGuideResponse|CompanyResearch|CompanyResearchResponse|RedFlag|RedFlagsResponse|NegotiateBody|ChatMessage|NegotiateResponse|StarAnswerBody|StarAnswerResponse|LearningResource|LearningPlanItem|LearningPlanResponse|InterviewQuestionsResponse|MarketInsightsResponse|CareerPathStep|CareerPathResponse|FollowUpEmailBody|FollowUpEmailResponse|PracticeFeedbackBody|PracticeFeedbackResponse|PredictOfferResponse|MockInterviewBody|MockInterviewResponse):" lib/api-spec/openapi.yaml
```
Expected: no output.

---

## Task 3: Edit OpenAPI spec — remove fields from `Analysis` schema

**Files:**
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Remove fields from the `Analysis` schema**

Inside `components.schemas.Analysis.properties`, delete these property entries:
- `interviewQuestions`
- `learningPlan`
- `salaryGuide`
- `companyResearch`
- `redFlags`

Then in `components.schemas.Analysis.required`, delete the entries:
- `- interviewQuestions`
- `- learningPlan`

(`salaryGuide`, `companyResearch`, `redFlags` are not in `required` — confirm by reading the `required:` block.)

- [ ] **Step 2: Verify with grep**

Run:
```bash
grep -nE "^\s*(interviewQuestions|learningPlan|salaryGuide|companyResearch|redFlags):" lib/api-spec/openapi.yaml
```
Expected: no output (assuming none of these names are reused elsewhere; spot-check the matches if any appear).

---

## Task 4: Run Orval codegen and commit spec + generated

**Files:**
- Modify (via codegen): `lib/api-zod/src/generated/**`, `lib/api-client-react/src/generated/**`

- [ ] **Step 1: Run codegen**

Run:
```bash
pnpm --filter @workspace/api-spec run codegen
```
Expected: Orval regenerates files; the chained `typecheck:libs` step passes. If it fails because the removed types are still referenced by other lib code (unlikely — the libs only export generated content), inspect the error and report back.

- [ ] **Step 2: Verify removed types no longer exist in generated output**

Run:
```bash
grep -rE "SalaryGuide|CompanyResearch|RedFlag|Negotiate|StarAnswer|LearningPlan|InterviewQuestions|MarketInsights|CareerPath|FollowUpEmail|PracticeFeedback|PredictOffer|MockInterview" lib/api-zod/src/generated lib/api-client-react/src/generated
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/api-spec/openapi.yaml lib/api-zod lib/api-client-react
git commit -m "chore(api-spec): remove interview-prep and career-dev endpoints"
```

---

## Task 5: Drop DB columns and types from schema

**Files:**
- Modify: `lib/db/src/schema/analyses.ts`

- [ ] **Step 1: Edit `lib/db/src/schema/analyses.ts`**

Delete these exported types entirely:
- `LearningResource` (lines ~9-14 in current file)
- `LearningPlanItem` (lines ~16-21)
- `SalaryRange` (lines ~23-32)
- `CompanyResearch` (lines ~34-41)
- `RedFlag` (lines ~43-48)

Inside `sqliteTable("analyses", { … })`, delete these column entries:
- `interviewQuestions: text("interview_questions", { mode: "json" }) …`
- `learningPlan: text("learning_plan", { mode: "json" }) …`
- `salaryGuide: text("salary_guide", { mode: "json" }) …`
- `companyResearch: text("company_research", { mode: "json" }) …`
- `redFlags: text("red_flags", { mode: "json" }) …`

Final file should match this exactly (preserve indentation; the surrounding rows are kept):

```ts
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
```

- [ ] **Step 2: Check the schema barrel exports**

Run:
```bash
grep -nE "LearningResource|LearningPlanItem|SalaryRange|CompanyResearch|RedFlag" lib/db/src/schema/index.ts lib/db/src/index.ts
```
Expected: no output. If any of those names are re-exported, delete those export lines too.

- [ ] **Step 3: Push schema to local SQLite**

Run:
```bash
pnpm --filter @workspace/db run push-force
```
The `-force` variant skips the interactive prompt. Expected: drizzle-kit reports columns dropped, no errors. If it warns about data loss, that's expected — the columns are being dropped intentionally.

- [ ] **Step 4: Typecheck libs**

Run:
```bash
pnpm run typecheck:libs
```
Expected: passes. If it fails because `api-zod` or anywhere else still references the deleted DB types, those references should not exist (the spec/regen already removed them). Report any failures.

- [ ] **Step 5: Commit**

```bash
git add lib/db/src/schema/analyses.ts lib/db/src/schema/index.ts lib/db/src/index.ts
git commit -m "refactor(db): drop interview/learning/salary/company/red-flags columns"
```

---

## Task 6: Remove API server routes (interview-questions, star-answer, learning-plan, interview-practice/mock-interview, practice-feedback)

**Files:**
- Modify: `artifacts/api-server/src/routes/analyses.ts`

- [ ] **Step 1: Delete these route handlers**

Each is a `router.post("/analyses/:id/<path>", async (req, res) => { … });` block. Delete from the `router.post(` line through and including its closing `});`.

- `router.post("/analyses/:id/interview-questions", …)` (currently around line 1057–1117)
- `router.post("/analyses/:id/star-answer", …)` (around line 1456–1526)
- `router.post("/analyses/:id/learning-plan", …)` (around line 1119–1177)
- `router.post("/analyses/:id/practice-feedback", …)` (around line 1825–end of relevant block)
- `router.post("/analyses/:id/mock-interview", …)` (around line 1764–1823)

- [ ] **Step 2: Verify**

Run:
```bash
grep -nE "router\.post\(\"/analyses/:id/(interview-questions|star-answer|learning-plan|practice-feedback|mock-interview)\"" artifacts/api-server/src/routes/analyses.ts
```
Expected: no output.

---

## Task 7: Remove API server routes (salary-guide, market-insights, career-path, follow-up-email, negotiate, company-research, red-flags, predict-offer)

**Files:**
- Modify: `artifacts/api-server/src/routes/analyses.ts`

- [ ] **Step 1: Delete these route handlers**

- `router.post("/analyses/:id/salary-guide", …)` (around line 724)
- `router.post("/analyses/:id/market-insights", …)` (around line 1576)
- `router.post("/analyses/:id/career-path", …)` (around line 1622)
- `router.post("/analyses/:id/follow-up-email", …)` (around line 1665)
- `router.post("/analyses/:id/negotiate", …)` (around line 1382)
- `router.post("/analyses/:id/company-research", …)` (around line 1242)
- `router.post("/analyses/:id/red-flags", …)` (around line 1311)
- `router.post("/analyses/:id/predict-offer", …)` (around line 1713)

- [ ] **Step 2: Verify**

Run:
```bash
grep -nE "router\.post\(\"/analyses/:id/(salary-guide|market-insights|career-path|follow-up-email|negotiate|company-research|red-flags|predict-offer)\"" artifacts/api-server/src/routes/analyses.ts
```
Expected: no output.

---

## Task 8: Clean up imports and duplicate-handler defaults in routes file

**Files:**
- Modify: `artifacts/api-server/src/routes/analyses.ts`

- [ ] **Step 1: Remove unused imports from `@workspace/api-zod`**

The top of `routes/analyses.ts` has a big block of imports. Delete these entries (keep the others):

```
GenerateInterviewQuestionsParams,
GenerateLearningPlanParams,
GenerateSalaryGuideParams,
GetPracticeFeedbackBody,
PredictOfferParams,
ConductMockInterviewParams,
ConductMockInterviewBody,
```

After editing, the import block should look like (verify the final list matches what remains in use):

```ts
import {
  CreateAnalysisBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  GenerateCoverLetterParams,
  GenerateCoverLetterBody,
  GenerateLinkedinPostParams,
  RewriteBulletParams,
  RewriteBulletBody,
  UpdateAnalysisParams,
  UpdateAnalysisBody,
  ShareAnalysisParams,
  UnshareAnalysisParams,
  GetSharedAnalysisParams,
  FetchJobDescriptionBody,
  DuplicateAnalysisParams,
} from "@workspace/api-zod";
```

- [ ] **Step 2: Remove the `interviewQuestions: []` and `learningPlan: []` defaults from the duplicate handler**

Find the `router.post("/analyses/:id/duplicate", …)` block (around line 673). Inside the `.insert(analyses).values({ … })` call (around lines 710–711), delete:
```ts
      interviewQuestions: [],
      learningPlan: [],
```

- [ ] **Step 3: Typecheck the API server**

Run:
```bash
pnpm --filter @workspace/api-server run typecheck
```
Expected: passes. If errors reference removed types/fields, find and clean up the lingering reference (likely something inside the now-deleted route bodies that wasn't fully removed in Tasks 6 or 7).

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/routes/analyses.ts
git commit -m "refactor(api-server): remove interview-prep and career-dev routes"
```

---

## Task 9: Delete standalone frontend component files

**Files:**
- Delete: 7 files

- [ ] **Step 1: Delete the component files**

Run:
```bash
rm artifacts/resume-matcher/src/components/interview-practice.tsx \
   artifacts/resume-matcher/src/components/mock-interview.tsx \
   artifacts/resume-matcher/src/components/market-insights.tsx \
   artifacts/resume-matcher/src/components/career-path.tsx \
   artifacts/resume-matcher/src/components/negotiation-calculator.tsx \
   artifacts/resume-matcher/src/components/follow-up-email.tsx \
   artifacts/resume-matcher/src/components/predictive-analytics.tsx
```

- [ ] **Step 2: Delete the Skills page**

Run:
```bash
rm artifacts/resume-matcher/src/pages/skills.tsx
```

- [ ] **Step 3: Verify no lingering references via grep**

Run:
```bash
grep -rE "from \"@/components/(interview-practice|mock-interview|market-insights|career-path|negotiation-calculator|follow-up-email|predictive-analytics)\"" artifacts/resume-matcher/src
grep -rE "from \"@/pages/skills\"" artifacts/resume-matcher/src
```
Expected: each grep prints only the files we're about to clean up in Task 10 (`App.tsx`, `analysis.tsx`, `layout.tsx`, `command-palette.tsx`). Note the file names — these are the next targets.

- [ ] **Step 4: Do NOT commit yet.** Continue to Task 10 — the deletions leave broken imports that Task 10 fixes.

---

## Task 10: Clean up `App.tsx`, `layout.tsx`, `command-palette.tsx`

**Files:**
- Modify: `artifacts/resume-matcher/src/App.tsx`
- Modify: `artifacts/resume-matcher/src/components/layout.tsx`
- Modify: `artifacts/resume-matcher/src/components/command-palette.tsx`

- [ ] **Step 1: Edit `App.tsx`**

Remove the line:
```ts
import { Skills } from "@/pages/skills";
```
And remove the route:
```tsx
<Route path="/skills" component={Skills} />
```

- [ ] **Step 2: Edit `layout.tsx`**

Open the file, find any nav-link entries whose `href`/`to` is `/skills`, and remove those entries.

Run before editing:
```bash
grep -n "/skills\b" artifacts/resume-matcher/src/components/layout.tsx
```
Use the line numbers reported to remove the matching nav-item entries (typically these are objects in an array like `{ label: "Skills", href: "/skills", … }`). Remove the whole object including its trailing comma.

Also remove any imports referencing the deleted components (none should be imported here, but verify with):
```bash
grep -nE "interview-practice|mock-interview|market-insights|career-path|negotiation-calculator|follow-up-email|predictive-analytics" artifacts/resume-matcher/src/components/layout.tsx
```
Expected (after edit): no output.

- [ ] **Step 3: Edit `command-palette.tsx`**

Run:
```bash
grep -n "/skills\b\|skills\b\|interview-practice\|mock-interview\|market-insights\|career-path\|negotiation-calculator\|follow-up-email\|predictive-analytics" artifacts/resume-matcher/src/components/command-palette.tsx
```
Remove command-palette entries (typically objects in a commands array) that:
- Navigate to `/skills`
- Trigger any of the deleted features (e.g. "Generate learning plan", "Open negotiation calculator")
- Reference any of the deleted component files

Remove only those entries — leave unrelated entries alone.

- [ ] **Step 4: Do NOT commit yet.** Continue to Task 11.

---

## Task 11: Surgically clean `pages/analysis.tsx`

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/analysis.tsx`

This is the biggest cleanup. The file mounts the deleted sections inline and defines several inner section components.

- [ ] **Step 1: Remove imports**

At the top of the file, delete these imports:
```ts
import { NegotiationCalculator } from "@/components/negotiation-calculator";
import { InterviewPractice } from "@/components/interview-practice";
import { MarketInsights } from "@/components/market-insights";
import { CareerPath } from "@/components/career-path";
import { FollowUpEmail } from "@/components/follow-up-email";
import { PredictiveAnalytics } from "@/components/predictive-analytics";
import { MockInterview } from "@/components/mock-interview";
```

Also delete any imports of `LearningPlanItem` or other removed types from `@workspace/db`. Run:
```bash
grep -n "LearningPlanItem\|SalaryRange\|CompanyResearch\|RedFlag" artifacts/resume-matcher/src/pages/analysis.tsx
```
Remove every import that references those types. The local variable declarations that used them will be removed in Step 3.

- [ ] **Step 2: Remove the inline section components**

Inside this file are several section components defined as `function <Name>Section(...)` or `function <Name>(...)`. Delete each in full (from `function` keyword to its closing `}`):
- `InterviewQuestions` (interview-questions section)
- `STARHelper`
- `LearningPlanSection`
- `SalaryGuideSection`
- `CompanyResearchSection`
- `RedFlagsSection`
- `MarketInsightsSection`
- `CareerPathSection`

Find each with:
```bash
grep -nE "^function (InterviewQuestions|STARHelper|LearningPlanSection|SalaryGuideSection|CompanyResearchSection|RedFlagsSection|MarketInsightsSection|CareerPathSection)\b" artifacts/resume-matcher/src/pages/analysis.tsx
```

- [ ] **Step 3: Remove local variable declarations**

Find this block in the main `Analysis` component (around lines 1827–1841):
```ts
const interviewQuestions = (analysis.interviewQuestions as string[]) ?? [];
const learningPlan = (analysis.learningPlan as LearningPlanItem[]) ?? [];
const salaryGuide = analysis.salaryGuide as {
  …
} | null;
const companyResearch = analysis.companyResearch as {
  …
} | null;
const redFlags = analysis.redFlags as Array<…> | null;
const marketInsights = (analysis as any).marketInsights as any | null ?? null;
const careerPath = (analysis as any).careerPath as any | null ?? null;
```

Delete every one of these variable declarations.

- [ ] **Step 4: Remove the JSX mounts**

Find and delete the JSX usages (around lines 2149–2195):
```tsx
<SalaryGuideSection analysisId={id} existing={salaryGuide} />
<CompanyResearchSection analysisId={id} existing={companyResearch} />
<RedFlagsSection analysisId={id} existing={redFlags} />
<InterviewQuestions analysisId={id} existingQuestions={interviewQuestions} />
{interviewQuestions.length > 0 && (
  <STARHelper analysisId={id} questions={interviewQuestions} />
)}
<LearningPlanSection analysisId={id} existingItems={learningPlan} />
<MarketInsightsSection analysisId={id} existing={marketInsights} />
<CareerPathSection analysisId={id} existing={careerPath} />
{interviewQuestions.length > 0 && (
  <InterviewPractice analysisId={id} questions={interviewQuestions} />
)}
<PredictiveAnalytics analysisId={id} fitScore={analysis.fitScore} />
```

Also remove any `<NegotiationCalculator …/>`, `<FollowUpEmail …/>`, and `<MockInterview …/>` mounts (find them with):
```bash
grep -nE "<(NegotiationCalculator|FollowUpEmail|MockInterview)\b" artifacts/resume-matcher/src/pages/analysis.tsx
```

- [ ] **Step 5: Remove the salary-negotiation chat block**

Around lines 1397–1466, there is an inline UI block (heading "Practice salary negotiation with an AI recruiter…" through the message-send `<button>`). It uses a `useNegotiate` or similar hook. Delete the entire JSX block plus any associated `useState`/`useMutation` hooks declared above for this feature only.

Confirm what to remove by reading the section first:
```bash
sed -n '1380,1475p' artifacts/resume-matcher/src/pages/analysis.tsx
```

- [ ] **Step 6: Remove the salary-related rendering that uses `salaryGuide`**

The file has a `SalaryGuideSection` block (already deleted in Step 2) but also a `guide` usage (around line 562, 658–664) — that's inside the deleted section, so it should already be gone. Verify:
```bash
grep -nE "salaryGuide|negotiationTips" artifacts/resume-matcher/src/pages/analysis.tsx
```
Expected: no output. The remaining `followUpDate`, `contactEmail`, `contactName`, `deadline` references are kept — they're for the Pipeline section, not Career Dev.

- [ ] **Step 7: Verify no leftover hook usage**

Run:
```bash
grep -nE "useGenerate(SalaryGuide|CompanyResearch|InterviewQuestions|LearningPlan|MarketInsights|CareerPath|FollowUpEmail)|useDetectRedFlags|useSimulateNegotiation|useGenerateStarAnswer|usePredictOffer|useConductMockInterview|useGetPracticeFeedback" artifacts/resume-matcher/src/pages/analysis.tsx
```
Expected: no output.

- [ ] **Step 8: Do NOT commit yet.** Continue to Task 12.

---

## Task 12: Clean salary aggregation from `pages/stats.tsx`

**Files:**
- Modify: `artifacts/resume-matcher/src/pages/stats.tsx`

- [ ] **Step 1: Remove the salary-guide aggregation**

Find this block (around lines 256–258):
```ts
.filter((a) => a.salaryGuide != null)
.map((a) => {
  const sg = a.salaryGuide as { low: number; mid: number; high: number };
  …
});
```

This is part of a larger computation. Read the surrounding context first:
```bash
sed -n '240,290p' artifacts/resume-matcher/src/pages/stats.tsx
```

Identify the full statement (likely a `const salaryStats = analyses.filter(...).map(...)` and any JSX/widget that displays the result). Delete the entire `salaryStats` (or similarly named) computation and any JSX block that renders it.

- [ ] **Step 2: Verify**

Run:
```bash
grep -nE "salaryGuide|salaryStats" artifacts/resume-matcher/src/pages/stats.tsx
```
Expected: no output.

- [ ] **Step 3: Typecheck the frontend**

Run:
```bash
pnpm --filter @workspace/resume-matcher run typecheck
```
Expected: passes. If errors appear, address them in the file the compiler points to — likely a leftover usage of a deleted hook, type, or variable.

- [ ] **Step 4: Commit**

```bash
git add artifacts/resume-matcher/src
git commit -m "refactor(frontend): remove interview-prep and career-dev UI"
```

---

## Task 13: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Delete the two feature sections**

In `README.md`, delete the entire `### Interview Preparation` section (heading + its bullets, currently lines 18–24) and the entire `### Career Development` section (heading + its bullets, currently lines 25–33).

Read first to confirm exact bounds:
```bash
sed -n '8,50p' README.md
```

After editing, the Features list jumps from `### Core Analysis` directly to `### Job Application Management`.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: remove interview-prep and career-dev from feature list"
```

---

## Task 14: Final whole-repo verification

**Files:** (verification only)

- [ ] **Step 1: Repo-wide typecheck**

Run:
```bash
pnpm run typecheck
```
Expected: passes for libs and all artifacts.

- [ ] **Step 2: Sanity grep for leftover references**

Run:
```bash
grep -rE "interview-practice|mock-interview\.tsx|market-insights\.tsx|career-path\.tsx|negotiation-calculator|follow-up-email\.tsx|predictive-analytics" \
  artifacts lib --include="*.ts" --include="*.tsx" --include="*.yaml" 2>/dev/null
grep -rE "salaryGuide|companyResearch\W|redFlags\W|learningPlan\W|interviewQuestions\W|marketInsights\W|careerPath\W" \
  artifacts lib --include="*.ts" --include="*.tsx" --include="*.yaml" 2>/dev/null | grep -v "src/generated"
```
Expected first grep: no output.
Expected second grep: no output (the `src/generated` exclusion guards against any stale generated files; if anything appears there, re-run `pnpm --filter @workspace/api-spec run codegen`).

- [ ] **Step 3: Smoke-run the app**

In one terminal:
```bash
pnpm --filter @workspace/api-server run dev
```

In another:
```bash
cd artifacts/resume-matcher && pnpm run dev
```

Open `http://localhost:5173` in a browser:
1. Confirm Home page loads with no console errors.
2. Open an existing Analysis (or create a new one) — confirm:
   - No "Interview Questions", "STAR Helper", "Learning Plan", "Salary Guide", "Company Research", "Red Flags", "Market Insights", "Career Path", "Interview Practice", "Negotiation Calculator", "Follow-up Email", "Predictive Analytics" sections appear.
   - Cover Letter, LinkedIn Post, Pipeline (deadline/follow-up/contact), and core analysis (fit score, ATS, strengths, gaps, keywords) all still render.
3. Confirm `/skills` route shows the NotFound page.
4. Open the command palette (⌘K / Ctrl+K) — confirm no entries reference deleted features.

If any of the above fails, fix and re-test before merging.

- [ ] **Step 4: Final commit if anything additional changed**

If Step 3 surfaced any remaining cleanup, commit it:
```bash
git add -A
git commit -m "chore: clean up trailing refs from interview-prep/career-dev removal"
```

Otherwise, this task is verification-only and produces no commit.

---

## Done

All 14 tasks complete. The branch is ready for PR review.
