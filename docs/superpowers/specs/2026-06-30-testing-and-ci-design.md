# Testing + CI Bootstrap

**Date:** 2026-06-30
**Status:** Approved for implementation
**Scope:** Phase 3 items 8 (testing) + 9 (CI) from the "improvements 1-12" plan, executed as one PR.

## Goal

Bring the repo from zero test coverage and no CI gates to: 15+ real tests across api-zod / lib/db / api-server, plus a GitHub Actions workflow that runs typecheck + tests + build on every PR.

## Decisions

| Question | Decision |
|---|---|
| Test runner | Vitest (native ESM, native TypeScript, same family as Vite) |
| Initial test scope | Sensible baseline: api-server routes (non-AI), api-zod schema validation, lib/db schema integrity |
| Frontend test scope | Vitest configured; no frontend tests in this PR (defer to a later sub-project) |
| Test DB | In-memory SQLite via `better-sqlite3` `:memory:` |
| Schema materialization | Generate `lib/db/src/schema.sql` once via `drizzle-kit` and check it in. Tests `exec()` it into in-memory DB |
| HTTP client for route tests | `supertest` (with `@types/supertest`) |
| CI gates | typecheck → tests → build. All hard gates |
| CI Node + pnpm | Node 22 LTS + pnpm 11 (matches `packageManager` field) |
| ESLint | Out of scope. No ESLint in this PR |

## Test inventory (planned)

### `lib/api-zod` — 2 tests (`src/index.test.ts`)

- `CreateAnalysisBody` accepts a valid payload (`jobTitle`, `resumeText`, `jobDescriptionText`).
- `CreateAnalysisBody` rejects when `jobTitle` is missing.

### `lib/db` — 3 tests (`src/schema.test.ts`)

- Insert with all required fields succeeds.
- Insert without `jobTitle` fails (drizzle-zod validation).
- Insert applies defaults: `strengths` → `[]`, `status` → `"not_applied"`, `isFavorite` → `false`, `tags` → `[]`, `portfolioLinks` → `[]`.

### `artifacts/api-server` — 9 tests across 2 files

`src/routes/health.test.ts`:
- `GET /api/healthz` returns 200 + a JSON body indicating health.

`src/routes/analyses.test.ts`:
- `GET /api/analyses` returns `[]` on empty DB.
- `GET /api/analyses` returns inserted rows in `desc(createdAt)` order.
- `GET /api/analyses/:id` returns 404 when missing.
- `GET /api/analyses/:id` returns the row when present.
- `DELETE /api/analyses/:id` removes the row.
- `PATCH /api/analyses/:id` updates editable fields (e.g., `status`, `isFavorite`, `notes`).
- `POST /api/analyses/:id/duplicate` clones the row under a new id.
- Share token flow: `POST /api/analyses/:id/share` issues a token, `GET /api/share/:token` returns the row, `DELETE /api/analyses/:id/share` revokes (subsequent GET returns 404).

**Total: 14 real tests** hitting endpoints that don't require an AI key.

## File map

### Files to create

```
lib/api-zod/vitest.config.ts                    — vitest config (node env)
lib/api-zod/src/index.test.ts                   — 2 schema tests
lib/db/vitest.config.ts                         — vitest config (node env)
lib/db/src/schema.sql                           — generated CREATE TABLE statements
lib/db/src/test-helpers.ts                      — `createTestDb()` → in-memory DB
lib/db/src/schema.test.ts                       — 3 schema tests
artifacts/api-server/vitest.config.ts           — vitest config (node env)
artifacts/api-server/src/test/setup.ts          — wires test DB into the app
artifacts/api-server/src/routes/health.test.ts  — 1 test
artifacts/api-server/src/routes/analyses.test.ts — 8 tests
artifacts/resume-matcher/vitest.config.ts       — vitest config (jsdom env), no test files yet
vitest.workspace.ts                             — root vitest workspace pointing at the configs
.github/workflows/ci.yml                        — CI workflow
```

### Files to modify

```
package.json                                    — root scripts (test); root devDeps (vitest if needed)
lib/api-zod/package.json                        — add `test` script + vitest devDep
lib/db/package.json                             — add `test` + `db:schema-sql` scripts + vitest + better-sqlite3 (already a dep)
artifacts/api-server/package.json               — add `test` script + vitest + supertest + @types/supertest
artifacts/resume-matcher/package.json           — add `test` script + vitest + jsdom (just so the runner exists)
README.md                                       — add "Testing" section
```

## Schema-sql generation flow

Goal: a checked-in `lib/db/src/schema.sql` representing the current Drizzle schema, used by tests to spin up an in-memory DB.

Generation strategy (one-time, then re-run after schema changes):
- Add a new script `db:schema-sql` in `lib/db/package.json` that uses `drizzle-kit generate` against a sqlite `file::memory:?cache=shared` target with `--name init`, then concatenates the emitted migration into `src/schema.sql`.
- Alternatively, since drizzle-kit's output is migration files in `lib/db/drizzle/`, we can simply check those in. But the spec scoped item 12 (Drizzle migrations) as a separate piece — we don't want to start that flow here.

Compromise: a small Node script at `scripts/generate-schema-sql.mjs` that imports `@workspace/db`'s schema, walks the table definitions, and emits raw `CREATE TABLE` SQL via better-sqlite3's introspection on a `:memory:` DB after calling drizzle's `pushSchema()` equivalent. The script runs once during this PR; the output (`schema.sql`) is checked in.

Concretely:
1. Spin up an in-memory better-sqlite3 instance in the script.
2. Use `drizzle-orm/better-sqlite3`'s migrator OR raw SQL emission. Drizzle does not expose a direct `dumpSchema` API, so the simplest path: import the schema, iterate `Object.values(schema)`, and for each `SQLiteTable`, emit `CREATE TABLE` from its `_.config.columns`.
3. Write the result to `lib/db/src/schema.sql`.

If walking the column config proves brittle in the implementer's hands, fallback: run `pnpm --filter @workspace/db run push-force` against an in-memory DB and use `sqlite_master` to dump the resulting schema:

```js
const rows = db.prepare("SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL").all();
const sql = rows.map(r => r.sql + ';').join('\n\n');
```

That is robust and uses Drizzle's own materialization.

The implementer can pick whichever path is simpler. Both produce the same checked-in `schema.sql`.

## Test DB helper (`lib/db/src/test-helpers.ts`)

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.join(__dirname, "schema.sql");

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const ddl = readFileSync(SCHEMA_SQL_PATH, "utf8");
  sqlite.exec(ddl);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite, close: () => sqlite.close() };
}
```

Exported from `lib/db` so consumers can import via `@workspace/db/test-helpers` (subpath export added to `lib/db/package.json` `exports`).

## API-server test wiring (`artifacts/api-server/src/test/setup.ts`)

The api-server's routes import `db` from `@workspace/db` directly. To make routes hit a test DB instead, the simplest approach: don't try to swap; instead make tests configure a `DATABASE_URL=:memory:` env var before importing the app. But the current `lib/db/src/index.ts` reads `DATABASE_URL` once at module import — once it's loaded with the real DB, tests can't change it.

Two options:
- **A. Refactor `lib/db` to accept a DB instance:** change `db` from a module-level constant to a factory invocation that reads env at the right time. Modest refactor, ~20 lines. Cleanly testable.
- **B. Set `DATABASE_URL=file::memory:?cache=shared` in test setup, before any import of the api-server modules:** Vitest's `globalSetup` or env-mocking via `import.meta.env` does this. The test DB then comes from the same `db` singleton as production code, just pointed at memory.

**Decision: Option B** for simplicity. Vitest setup file sets `DATABASE_URL=file::memory:?cache=shared` before any module is imported. The file::memory pattern in better-sqlite3 lets multiple connections share one in-memory DB, which is what we need since the api-server's middleware also imports `db`.

The `src/test/setup.ts`:
```ts
import { beforeAll, beforeEach, afterAll } from "vitest";

process.env.DATABASE_URL = "file::memory:?cache=shared";

import { db, analyses, notifications } from "@workspace/db";
import { readFileSync } from "node:fs";
import path from "node:path";

beforeAll(() => {
  // Apply the schema. We can't use the lib/db helper directly since the
  // app's `db` singleton already opened ?cache=shared. Use the same sqlite
  // handle drizzle returned, accessed via the internal session.
  const ddl = readFileSync(
    path.resolve(__dirname, "../../../lib/db/src/schema.sql"),
    "utf8",
  );
  // drizzle exposes the underlying sqlite via `db.$client` (better-sqlite3 driver)
  (db as unknown as { $client: { exec: (sql: string) => void } }).$client.exec(ddl);
});

beforeEach(async () => {
  // Clear tables between tests.
  (db as unknown as { $client: { exec: (sql: string) => void } }).$client.exec(
    "DELETE FROM analyses; DELETE FROM notifications;",
  );
});

afterAll(() => {
  // Process exit will close the DB; nothing to do.
});

export { db, analyses, notifications };
```

If `db.$client` isn't typed/exposed, fall back to importing better-sqlite3 directly and opening a second connection on the same `file::memory:?cache=shared` URI.

## Vitest workspace configuration

Root `vitest.workspace.ts`:
```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "lib/api-zod/vitest.config.ts",
  "lib/db/vitest.config.ts",
  "artifacts/api-server/vitest.config.ts",
  "artifacts/resume-matcher/vitest.config.ts",
]);
```

Per-workspace `vitest.config.ts` (lib/api-zod, lib/db, api-server all node):
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "<workspace-name>",
    environment: "node",
    globals: false,
    include: ["**/*.test.ts"],
  },
});
```

Frontend (`artifacts/resume-matcher/vitest.config.ts`):
```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "resume-matcher",
    environment: "jsdom",
    globals: false,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    setupFiles: [],
  },
});
```

## Root scripts

In root `package.json`:
```json
"scripts": {
  ...
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Per workspace `package.json`:
```json
"scripts": {
  ...
  "test": "vitest run"
}
```

(With Vitest workspaces, the root `vitest run` command discovers all configs automatically. Per-workspace scripts are convenience for running just one.)

## CI workflow

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm run typecheck
        name: Typecheck

      - run: pnpm run test
        name: Tests

      - run: pnpm run build
        name: Build
```

`permissions: contents: read` minimizes scope. `concurrency` cancels superseded runs on the same PR branch.

## Non-goals

- AI-gated route coverage (cover-letter, salary, etc.) — needs mocked AI client. Defer to item 10.
- Frontend component tests — Vitest is configured but no tests added.
- E2E / Playwright — separate sub-project.
- Coverage thresholds — Vitest supports v8 coverage; no blocking gate set.
- ESLint — not in scope.
- Renovate / Dependabot — not in scope.

## Risks

| Risk | Mitigation |
|---|---|
| `schema.sql` drifts from `schema.ts` | Add a `db:schema-sql` script. Document running it on schema changes. Optionally CI can run it and `git diff --exit-code` to verify (skipped this round to avoid scope creep). |
| `pnpm install --frozen-lockfile` fails because `pnpm-lock.yaml` isn't pristine | Run `pnpm install` locally before pushing; resolve any drift |
| Drizzle's column-walk strategy for `schema.sql` generation produces wrong SQL | Use the `sqlite_master` dump approach instead (well-tested path) |
| Tests share the same in-memory DB across files due to `?cache=shared` | Add `beforeEach` cleanup that DELETEs from all tables. Acceptable since we don't run in parallel by default (Vitest workspaces serialize across projects by default) |
| `supertest` + Express 5 typing mismatch | Spot-check on install; if needed, drop `supertest` and use `fetch` against `app.listen()` on port 0 |
| CI build step is slow (Vite + Tailwind) | Acceptable: 15-min timeout is generous. Cache hits should bring it to ~2-3 min |
| First CI run reveals pre-existing build break | We confirmed `pnpm typecheck`, `pnpm build` works locally on macOS. Fix any Linux-only issue as a follow-up |

## What "done" looks like

- `pnpm test` runs locally and passes
- 14 tests pass: 2 in api-zod, 3 in db, 9 in api-server
- `lib/db/src/schema.sql` exists and matches the Drizzle schema
- `vitest.workspace.ts` + per-workspace `vitest.config.ts` files exist
- `.github/workflows/ci.yml` exists
- CI runs on PR #19 (this PR) and passes
- README has a "Testing" section
- No existing functionality is broken (typecheck + build still pass)
