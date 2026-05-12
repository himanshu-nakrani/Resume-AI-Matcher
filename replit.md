# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TanStack Query + shadcn/ui + Wouter

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run push-force` — force push without prompts
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- After codegen: rebuild lib with `cd lib/api-zod && pnpm exec tsc -p tsconfig.json --noEmitOnError false`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Application: OptiMatch — AI Resume & Job Matcher

### Artifact paths
- Frontend: `artifacts/resume-matcher` (React + Vite, preview at `/`)
- API server: `artifacts/api-server` (Express 5, routes at `/api`)

### Features implemented
1. **Core analysis** — Paste resume + job description → AI fit score (0–100), ATS score, strengths, gaps, improvement suggestions, keyword matching
2. **Cover letter generator** — 4 tone options (professional/friendly/enthusiastic/concise)
3. **LinkedIn post generator** — personalized job-search post
4. **AI Bullet Rewriter** — paste any resume bullet, get a stronger version
5. **Interview Questions** — AI-generated likely questions based on role + resume gaps
6. **Learning Plan** — personalized study plan with specific resources (courses, certs, projects)
7. **Application Status Tracking** — mark each analysis as: Not Applied / Applied / Interview / Offer / Rejected
8. **Social Sharing** — create public share links (`/share/:token`), revocable; Email sharing button
9. **Favorites & Notes** — star analyses, add private notes (auto-saved)
10. **Job URL Import** — paste a job listing URL → AI extracts job description, title, company
11. **Advanced Stats** — fit/ATS score trends, distribution histogram, pipeline funnel, top keywords; clickable drilldown to filtered history
12. **History with Search/Filter** — search by title/company, filter by status, filter by favorites; Saved searches (localStorage); tags/deadline badges
13. **Themes** — 3 themes (warm/formal/minimal) + dark mode
14. **Export PDF** — print-optimized layout via `window.print()`
15. **Bulk CSV Export** — export all analyses from History page as CSV
16. **Duplicate Analysis** — clone any analysis (strips cover letter/linkedin/share, resets status)
17. **Job Tracking** — per-analysis deadline, follow-up date, contact name/email (with email mailto link), tags (add/remove chips); tracking chips shown in header
18. **AI Salary Guide** — AI-estimated salary range (low/mid/high) with market context, salary-raising factors, negotiation tips, visual bar
19. **Comparison View** — `/compare` route, pick any 2 analyses for side-by-side score/keyword/strength/gap comparison
20. **Keyboard Command Palette** — `⌘K` / `Ctrl+K` global search across all analyses, quick-jump to any analysis
21. **Company Research** — AI company overview, culture notes, red flags, interview tips
22. **Red Flags Detector** — AI scans job description for warning signs
23. **Negotiation Simulator** — multi-turn AI salary negotiation chat with offer/counter offers
24. **STAR Answer Helper** — generate or polish STAR-method interview answers per question
25. **Skills Tracker** — `/skills` page tracks most common matched/missing keywords across all analyses
26. **In-App Notifications (Phase 8)** — bell icon in sidebar/mobile header; auto-creates deadline (≤3 days) and follow-up notifications on every GET /analyses; mark-one/mark-all read; real-time badge count
27. **Interview Practice Mode (Phase 9)** — timed STAR answer practice (2-min timer) with local STAR component scoring; session history in localStorage; shown on analysis page when interview questions exist
28. **Negotiation Calculator (Phase 10)** — offer/target/floor salary calculator with gap analysis, midpoint, 5 script templates with auto-fill; collapsible on analysis page
29. **Funnel Analytics (Phase 12)** — pipeline widget on home page (applied → interview → offer conversion rates); full pipeline breakdown on Stats page
30. **Error Boundary (Tech Debt)** — wraps all routes in `Layout` + outer App; shows friendly error UI with "Try again" button
31. **DB Indexes (Tech Debt)** — indexes on `analyses.created_at`, `analyses.status`, `analyses.fit_score`, `notifications.read`, `notifications.created_at`
32. **Kanban Job Board** — `/board` page with 5 status columns; drag-and-drop cards (HTML5 API) to change status; Ember amber headers
33. **Brand Dashboard** — `/brand` page: keyword strength bars, skill gap map, fit score trend line chart, personal summary stats, strengths word-cloud
34. **Stats Enhancements** — keyword trends bar chart, time-in-stage metrics, interview/offer conversion cards, score momentum indicator
35. **Market Insights AI** — POST /analyses/:id/market-insights → role demand level, salary range, top in-demand skills, market context, hiring trend, remote outlook
36. **Career Path Planner AI** — POST /analyses/:id/career-path → current role inference, 3 next-step roles with timelines, 2 stretch/senior roles, overall timeline, key themes
37. **Follow-up Email Generator** — POST /analyses/:id/follow-up-email with emailType (after_apply/after_interview/thank_you) → subject, body, tips; copy-to-clipboard; shown on analysis page
38. **Portfolio Links** — up to 3 URLs (GitHub, portfolio, case study) saved per analysis via PATCH; shown as clickable ExternalLink badges
39. **Cover Letter Variations** — "Generate 2nd Variation" button cycles through tones; stored in local state for comparison/copying

### Key AI notes
- Model: `gpt-5.4` with `max_completion_tokens`
- All AI prompts use string concatenation (no template literals — esbuild issue)
- AI integration via `@workspace/integrations-openai-ai-server`

### DB schema
- Table: `analyses` in `lib/db/src/schema/analyses.ts`
- Table: `notifications` in `lib/db/src/schema/notifications.ts` — fields: id, type (deadline/follow_up/info), title, body, analysisId (FK→analyses cascade), read, createdAt
- Key analyses fields: `fitScore`, `atsScore`, `strengths[]`, `gaps[]`, `improvements[]`, `atsKeywordsMatched[]`, `atsKeywordsMissing[]`, `coverLetter`, `linkedinPost`, `interviewQuestions[]`, `learningPlan[]`, `status`, `isFavorite`, `notes`, `shareToken`, `isPublic`, `deadline`, `contactName`, `contactEmail`, `followUpDate`, `tags[]`, `salaryGuide` (jsonb), `portfolioLinks[]`

### API contract
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Zod schemas: `lib/api-zod/src/generated/api.ts` (only export `* from "./generated/api"`)
- React hooks: `lib/api-client-react/src/generated/api.ts` + `api.schemas.ts`

### Important patterns
- `lib/api-zod/src/index.ts` must only export `export * from "./generated/api"` — the `types/` subdirectory has duplicate names, re-exporting it causes TS2308 errors. After every codegen run, check and fix this.
- Shared analysis page (`/share/:token`) renders outside the main Layout (no sidebar)
- Notes auto-save after 1s debounce using `useUpdateAnalysis`
- Auto-notifications: GET /analyses side-effect creates deadline/follow_up notifications; idempotent (checks for existing)
- Interview Practice scoring is client-side (STAR keyword detection); AI-powered scoring available via POST /analyses/:id/practice-feedback
