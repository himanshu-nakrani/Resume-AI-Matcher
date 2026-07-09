# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OptiMatch is an AI-powered resume analysis and job application tracker: paste a resume + job description (or a job URL) and get a fit score, ATS keyword match, cover letter, and other AI-generated coaching content, then track applications on a Kanban board. It is a **pnpm workspace monorepo** (pnpm only — the root `preinstall` script rejects npm/yarn). Node 24, TypeScript 5.9. Shared dependency versions live in the `catalog:` section of `pnpm-workspace.yaml`.

Note: `README.md` and `replit.md` are partially stale (they still mention DeepSeek/OpenAI keys, `db push`, and port 3000 defaults). This file reflects the actual code.

## Commands

```bash
pnpm install                     # install all workspace deps
pnpm run typecheck               # tsc --build for libs + per-artifact typecheck
pnpm run build                   # typecheck + build all packages
pnpm run test                    # all workspace tests once (vitest workspace at root)
pnpm run test:watch              # watch mode
pnpm vitest run path/to/file.test.ts             # single test file (from repo root)
pnpm --filter @workspace/api-server run test     # one package's tests
```

CI (`.github/workflows/ci.yml`) runs exactly: `pnpm install --frozen-lockfile`, `typecheck`, `test`, `build`. There is no linter; Prettier is available at the root.

### Running locally

```bash
pnpm --filter @workspace/api-server run dev      # builds (esbuild) then starts; PORT defaults to 8080
pnpm --filter @workspace/resume-matcher run dev  # Vite dev server on 5173
```

The Vite dev server proxies `/api` to `API_ORIGIN` (default `http://127.0.0.1:3000`), while the API server's default `PORT` is 8080 — so for local dev either set `PORT=3000` in `artifacts/api-server/.env` or set `API_ORIGIN` for the frontend. Env vars for the API server go in `artifacts/api-server/.env` (dotenv, gitignored):

- `FIREWORKS_API_KEY` — required for AI features (legacy alias: `AI_INTEGRATIONS_OPENAI_API_KEY`). Optional overrides: `FIREWORKS_MODEL` (default `accounts/fireworks/models/glm-5p2`), `FIREWORKS_BASE_URL`.
- `EXA_API_KEY` — required for job URL import / job search.
- `DATABASE_URL` — optional SQLite file path; defaults to `resume-matcher.sqlite` at the workspace root. Postgres URLs are rejected.

## Architecture

```
artifacts/
  resume-matcher/   React 19 + Vite 7 frontend (Wouter routing, TanStack Query, shadcn/ui, Tailwind 4)
  api-server/       Express 5 API, bundled with esbuild (build.mjs), pino logging, prom-client metrics
  mockup-sandbox/   standalone UI sandbox, not part of the app
lib/
  api-spec/         openapi.yaml — the source of truth for the API contract
  api-zod/          Orval-GENERATED Zod schemas (used by api-server for validation)
  api-client-react/ Orval-GENERATED TanStack Query hooks + fetch client (used by frontend)
  db/               Drizzle ORM schema + versioned SQL migrations (better-sqlite3)
  integrations-openai-ai-server/  Fireworks AI client (OpenAI-compatible SDK), retry/limit, token metrics
```

### Contract-first API flow (the most important pipeline)

`lib/api-spec/openapi.yaml` is the single source of truth. To change the API:

1. Edit `openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen` — Orval regenerates `lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/` (with `clean: true`, so never hand-edit generated files), then runs the lib typecheck.
3. **Check `lib/api-zod/src/index.ts`**: it re-exports the generated Zod schemas plus an explicit, hand-maintained list of generated TS types, deliberately excluding names that collide with the Zod schema exports (colliders get `*Type` aliases at the bottom of the file). New generated types must be added to this list manually; blindly re-exporting `generated/types` causes TS2308 duplicate-export errors.
4. Implement the route in `artifacts/api-server/src/routes/` (Zod `.safeParse()` on input) and consume the generated hook in the frontend.

### API server

- Entry: `src/index.ts` — loads dotenv, runs DB migrations (`runMigrations` from `@workspace/db`), seeds a sample analysis if the DB is empty, then listens. `src/app.ts` wires middleware (request-id, pino-http, metrics) and mounts `src/routes/index.ts`.
- Route modules in `src/routes/` (analyses, job-search, saved-jobs, search-alerts, health, metrics) with colocated `*.test.ts` supertest tests.
- AI helpers in `src/lib/` — `parse-ai-json.ts` parses/repairs model JSON output, `send-ai-error.ts` maps AI failures to responses, `exa-*.ts` wrap Exa search, `latex-*.ts` handle resume LaTeX optimization/validation.
- Side-effect to know about: `GET /api/analyses` auto-creates deadline/follow-up notifications (idempotent).

### Database (`lib/db`)

Versioned migrations, applied automatically at api-server startup. To change the schema (full workflow in `lib/db/README.md`):

1. Edit `src/schema/*.ts` (export new tables from `src/schema/index.ts`).
2. `pnpm --filter @workspace/db run generate` → new `drizzle/000N_*.sql` + updated `drizzle/meta/`.
3. `pnpm --filter @workspace/db run db:schema-sql` → regenerates `src/schema.sql` (the test snapshot used by `createTestDb`).
4. `pnpm --filter @workspace/db run test`, then commit schema TS + migration SQL + meta + schema.sql together.

Rules: **never edit an already-committed migration** (its sha256 is checked; add a new migration instead) and **never use `drizzle-kit push`** (removed on purpose).

### AI integration

All AI calls go through `@workspace/integrations-openai-ai-server` (`getAiClient()` / `getAiModel()` / `runCompletion`), pointed at Fireworks via the OpenAI SDK. Long AI prompts in api-server routes are built with **string concatenation, not template literals** (a long-standing esbuild-related convention) — follow the surrounding style. Token usage is recorded via `setAiTokenRecorder` into prom-client metrics.

### Frontend (`artifacts/resume-matcher`)

- Routing in `src/App.tsx` with Wouter; every page is lazy-loaded (route-level code splitting). `/share/:token` renders **outside** the main `Layout` (public share page, no sidebar); all other routes are wrapped in `Layout` + `ErrorBoundary`.
- Path alias `@` → `src/` (defined in vite.config.ts and tsconfig).
- Server state exclusively via generated hooks from `@workspace/api-client-react`; notes auto-save with a 1s debounce through `useUpdateAnalysis`.
- GitHub Pages deploy (`.github/workflows/deploy-pages.yml`) builds with `BASE_PATH=/<repo>/`; the app derives its router base from `import.meta.env.BASE_URL`, so don't hardcode absolute paths.
