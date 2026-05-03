# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TanStack Query + shadcn/ui + Wouter

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

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
8. **Social Sharing** — create public share links (`/share/:token`), revocable
9. **Favorites & Notes** — star analyses, add private notes (auto-saved)
10. **Job URL Import** — paste a job listing URL → AI extracts job description, title, company
11. **Advanced Stats** — fit/ATS score trends, distribution histogram, pipeline funnel, top keywords
12. **History with Search/Filter** — search by title/company, filter by status, filter by favorites
13. **Themes** — 3 themes (warm/formal/minimal) + dark mode
14. **Export PDF** — print-optimized layout via `window.print()`

### Key AI notes
- Model: `gpt-5.4` with `max_completion_tokens`
- All AI prompts use string concatenation (no template literals — esbuild issue)
- AI integration via `@workspace/integrations-openai-ai-server`

### DB schema
- Table: `analyses` in `lib/db/src/schema/analyses.ts`
- Key fields: `fitScore`, `atsScore`, `strengths[]`, `gaps[]`, `improvements[]`, `atsKeywordsMatched[]`, `atsKeywordsMissing[]`, `coverLetter`, `linkedinPost`, `interviewQuestions[]`, `learningPlan[]`, `status`, `isFavorite`, `notes`, `shareToken`, `isPublic`

### API contract
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Zod schemas: `lib/api-zod/src/generated/api.ts` (only export `* from "./generated/api"`)
- React hooks: `lib/api-client-react/src/generated/api.ts` + `api.schemas.ts`

### Important patterns
- `lib/api-zod/src/index.ts` must only export `export * from "./generated/api"` — the `types/` subdirectory has duplicate names, re-exporting it causes TS2308 errors
- Shared analysis page (`/share/:token`) renders outside the main Layout (no sidebar)
- Notes auto-save after 1s debounce using `useUpdateAnalysis`
