# Remove Interview Preparation & Career Development feature sets

**Date:** 2026-06-25
**Status:** Approved for implementation
**Scope:** Surgical removal of README feature sections 3 (Interview Preparation) and 4 (Career Development), including adjacent `predict-offer` endpoint.

## Goals

Delete the following user-facing features and all supporting code (frontend, API, DB columns, generated client/zod, OpenAPI spec, README):

**Interview Preparation:** Interview Questions, STAR Helper, Interview Practice (timed STAR), Mock Interview, Company Research, Red Flags Detector.

**Career Development:** Learning Plan, AI Salary Guide, Market Insights, Career Path Planner, Negotiation Simulator (chat), Negotiation Calculator, Skills Tracker (`/skills`), Follow-up Email Generator.

**Adjacent:** Predictive Analytics (`/predict-offer`) — depends on the salary/career cluster.

## Non-goals

- Keep all Pipeline-management fields (`deadline`, `followUpDate`, `contact*`, ICS export) — they belong to README section 5.
- Keep `salaryExpectation` text field — user-entered metadata, reused elsewhere.
- No refactoring of unrelated code.

## Files affected

### Delete entirely

**Frontend components** (`artifacts/resume-matcher/src/components/`):
- `interview-practice.tsx`
- `mock-interview.tsx`
- `market-insights.tsx`
- `career-path.tsx`
- `negotiation-calculator.tsx`
- `follow-up-email.tsx`
- `predictive-analytics.tsx`

**Frontend pages** (`artifacts/resume-matcher/src/pages/`):
- `skills.tsx`

### Modify

**`artifacts/resume-matcher/src/pages/analysis.tsx`** — remove the following sections and their mounts:
- `InterviewQuestions`
- `STARHelper`
- `LearningPlanSection`
- `SalaryGuideSection`
- `CompanyResearchSection`
- `RedFlagsSection`
- `MarketInsightsSection`
- `CareerPathSection`
- `InterviewPractice` mount
- `NegotiationCalculator` mount
- `FollowUpEmail` mount
- `PredictiveAnalytics` mount
- Negotiation chat block (~lines 1397–1466)
- All imports referencing the above
- Local variable extractions: `interviewQuestions`, `learningPlan`, `salaryGuide`, `companyResearch`, `redFlags`, `marketInsights`, `careerPath`

**`artifacts/resume-matcher/src/App.tsx`** — remove `Skills` import + `<Route path="/skills" ...>`.

**`artifacts/resume-matcher/src/components/layout.tsx`** — remove `/skills` nav link (and any of the removed feature links).

**`artifacts/resume-matcher/src/components/command-palette.tsx`** — remove entries that navigate to `/skills` or trigger any deleted endpoint.

**`artifacts/resume-matcher/src/pages/stats.tsx`** — remove salary-guide aggregation block (~lines 256–258).

**`artifacts/api-server/src/routes/analyses.ts`** — delete these route handlers and their request schema imports:
- `POST /analyses/:id/interview-questions`
- `POST /analyses/:id/star-answer`
- `POST /analyses/:id/practice-feedback`
- `POST /analyses/:id/mock-interview`
- `POST /analyses/:id/company-research`
- `POST /analyses/:id/red-flags`
- `POST /analyses/:id/learning-plan`
- `POST /analyses/:id/salary-guide`
- `POST /analyses/:id/market-insights`
- `POST /analyses/:id/career-path`
- `POST /analyses/:id/negotiate`
- `POST /analyses/:id/follow-up-email`
- `POST /analyses/:id/predict-offer`

Also remove default values for `interviewQuestions` and `learningPlan` in the duplicate handler (line ~710).

**`lib/db/src/schema/analyses.ts`** — drop columns and types:
- Columns to drop: `interview_questions`, `learning_plan`, `salary_guide`, `company_research`, `red_flags`
- Remove exported types: `LearningResource`, `LearningPlanItem`, `SalaryRange`, `CompanyResearch`, `RedFlag`

Generate a Drizzle migration via `pnpm --filter @workspace/db run generate` (the workspace exposes `push` per README; check the package for `generate` script). Apply via `push`. SQLite shipped with `better-sqlite3` supports `ALTER TABLE … DROP COLUMN`.

**`lib/api-spec/openapi.yaml`** — remove:
- Paths: all 13 listed above.
- Response/request schemas: `GenerateSalaryGuide*`, `GenerateCompanyResearch*`, `DetectRedFlags*`, `SimulateNegotiation*`, `GenerateStarAnswer*`, `GenerateLearningPlan*`, `GenerateInterviewQuestions*`, `GenerateMarketInsights*`, `GenerateCareerPath*`, `GenerateFollowUpEmail*`, `ConductMockInterview*`, `GetPracticeFeedback*`, `PredictOffer*`.
- Reusable types: `LearningPlanItem`, `LearningResource`, `SalaryRange`, `CompanyResearch`, `RedFlag` (if defined under `components/schemas`).
- Fields in the `Analysis` (and any related response) schema: `interviewQuestions`, `learningPlan`, `salaryGuide`, `companyResearch`, `redFlags`. Update `required` arrays accordingly.

After editing, run `pnpm --filter @workspace/api-spec run codegen` to regenerate `lib/api-zod/src/generated` and `lib/api-client-react/src/generated`.

**`README.md`** — remove the bullet groups under "### Interview Preparation" and "### Career Development", including the headings themselves.

## Execution order

Single PR. Each step ends with a type-check before moving on; this keeps the repo internally consistent at every checkpoint.

1. **OpenAPI spec + codegen** — edit `openapi.yaml`; run `pnpm --filter @workspace/api-spec run codegen`. Verify generated artifacts updated.
2. **DB schema + migration** — edit `lib/db/src/schema/analyses.ts`; run Drizzle migration generation; apply via `push` against local SQLite.
3. **API server routes** — delete 13 route handlers + unused imports + duplicate-handler defaults. `pnpm --filter @workspace/api-server run typecheck`.
4. **Frontend** — delete 7 component files + `pages/skills.tsx`; surgically prune `pages/analysis.tsx`; remove `/skills` from `App.tsx`, `layout.tsx`, `command-palette.tsx`; remove salary aggregator from `stats.tsx`. `pnpm --filter @workspace/resume-matcher run typecheck`.
5. **README** — delete the two feature sections.
6. **Final** — `pnpm run typecheck` at root; smoke-run dev server, open Home + an existing Analysis to confirm no runtime references remain.

## Risks & mitigations

- **Risk:** Drizzle `drop column` migration fails on SQLite. **Mitigation:** better-sqlite3 ships with SQLite 3.45+, which supports DROP COLUMN. If Drizzle generates a table-rebuild migration instead, that's also acceptable.
- **Risk:** Codegen output still references removed types after spec edit. **Mitigation:** caught at API-server typecheck (step 3) before frontend work.
- **Risk:** Hidden references to removed components (e.g., in `mockup-sandbox`). **Mitigation:** repo-wide grep before step 4, and `pnpm run typecheck` at root.
- **Data loss:** Existing values in `interviewQuestions`, `learningPlan`, `salaryGuide`, `companyResearch`, `redFlags` columns are intentionally discarded.

## Rollback

Single `git revert` of the merge commit restores all features cleanly.
