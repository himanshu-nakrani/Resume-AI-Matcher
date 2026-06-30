# Testing + CI Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the repo from zero test coverage and no CI gates to: Vitest configured across workspaces, 14 real tests across api-zod/lib/db/api-server, and a GitHub Actions workflow gating typecheck + tests + build on every PR.

**Architecture:** Vitest with workspace projects. In-memory-style isolation per Vitest process via a temp-file SQLite (the existing `lib/db` `DATABASE_URL` resolver rejects non-`file:` URLs, so we point each test process at its own temp file). A checked-in `lib/db/src/schema.sql` materializes the schema for fresh test DBs. A single GitHub Actions workflow runs `pnpm typecheck && pnpm test && pnpm build` on every PR.

**Tech Stack:** Vitest 3.x, supertest 7.x, better-sqlite3 (already a dep), pnpm 11, Node 22, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-06-30-testing-and-ci-design.md`](../specs/2026-06-30-testing-and-ci-design.md)

---

## Background for the implementing engineer

This is Phase 3 items 8+9 from a long-running improvements list. The repo has zero tests today and only one GitHub Actions workflow (`deploy-pages.yml`).

**Branch:** `chore/testing-and-ci` (already checked out off main).

**Repo layout:**
- pnpm monorepo
- 4 workspaces matter: `lib/api-zod`, `lib/db`, `artifacts/api-server`, `artifacts/resume-matcher`
- `lib/db` uses Drizzle ORM + better-sqlite3
- `artifacts/api-server` uses Express 5 + Drizzle
- All TypeScript, all ESM

**Important fact from spec discovery:** `lib/db/src/index.ts` reads `DATABASE_URL` once at module import and only accepts `file:` URLs or plain file paths. The `file::memory:?cache=shared` SQLite URI is treated as a literal file path by the resolver — won't work. So tests use a tmp file per Vitest process. This is simpler and well-aligned with how production code works.

**Typecheck command (after every task):**
```bash
pnpm run typecheck
```
Every workspace must end with `Done`.

**Test command (after Task 4+):**
```bash
pnpm run test
```
Once all 14 tests are in place, this should report 14/14 passing.

**Conventions:**
- Don't change any production code unless it's the schema.sql generation
- Conventional commits
- Stay on branch `chore/testing-and-ci`

---

## File Map

### Files to create

```
.github/workflows/ci.yml                         — CI workflow
vitest.workspace.ts                              — root vitest workspace
lib/api-zod/vitest.config.ts                     — node env config
lib/api-zod/src/index.test.ts                    — 2 tests
lib/db/vitest.config.ts                          — node env config
lib/db/src/schema.sql                            — checked-in DDL
lib/db/src/test-helpers.ts                       — createTestDb()
lib/db/src/schema.test.ts                        — 3 tests
scripts/generate-schema-sql.mjs                  — one-off generator for schema.sql
artifacts/api-server/vitest.config.ts            — node env config
artifacts/api-server/src/test/setup.ts           — test DB wiring
artifacts/api-server/src/routes/health.test.ts   — 1 test
artifacts/api-server/src/routes/analyses.test.ts — 8 tests
artifacts/resume-matcher/vitest.config.ts        — jsdom env config (no test files yet)
```

### Files to modify

```
package.json                                     — add `test` script
lib/api-zod/package.json                         — add test script + vitest devDep
lib/db/package.json                              — add test + db:schema-sql scripts + vitest + subpath export for test-helpers
artifacts/api-server/package.json                — add test script + vitest + supertest + @types/supertest
artifacts/resume-matcher/package.json            — add test script + vitest + jsdom
README.md                                        — add "Testing" section
.gitignore                                       — add /tmp test DB pattern if needed (or rely on /tmp dir)
```

---

## Task 1: Install test dependencies

**Files:**
- Modify: `package.json` (root)
- Modify: `lib/api-zod/package.json`
- Modify: `lib/db/package.json`
- Modify: `artifacts/api-server/package.json`
- Modify: `artifacts/resume-matcher/package.json`

- [ ] **Step 1: Add Vitest as a workspace catalog entry**

Edit `pnpm-workspace.yaml`. Find the `catalog:` block (it has entries like `react: 19.1.0`, `vite: ^7.3.2`, etc.). Add:
```yaml
catalog:
  # ... existing entries ...
  vitest: ^3.0.0
```

- [ ] **Step 2: Add test devDeps to each workspace**

In `lib/api-zod/package.json`, add to `devDependencies`:
```json
"vitest": "catalog:"
```

In `lib/db/package.json`, add:
```json
"vitest": "catalog:"
```

In `artifacts/api-server/package.json`, add to `devDependencies`:
```json
"vitest": "catalog:",
"supertest": "^7.0.0",
"@types/supertest": "^6.0.2"
```

In `artifacts/resume-matcher/package.json`, add to `devDependencies`:
```json
"vitest": "catalog:",
"jsdom": "^25.0.0"
```

- [ ] **Step 3: Add test scripts**

In each of the 4 workspace `package.json` files, add to `scripts`:
```json
"test": "vitest run"
```

In root `package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Install**

```bash
pnpm install
```

Expected: clean install, lockfile updated. If `pnpm-lock.yaml` shows large diffs in unrelated packages, abort and report — something is off.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml \
        package.json \
        lib/api-zod/package.json lib/db/package.json \
        artifacts/api-server/package.json artifacts/resume-matcher/package.json \
        pnpm-lock.yaml
git commit -m "chore(deps): add vitest, supertest, jsdom for test infrastructure"
```

---

## Task 2: Generate schema.sql and add db test helpers

**Files:**
- Create: `scripts/generate-schema-sql.mjs`
- Create: `lib/db/src/schema.sql`
- Create: `lib/db/src/test-helpers.ts`
- Modify: `lib/db/package.json` (add `db:schema-sql` script + subpath export)

- [ ] **Step 1: Write the schema-sql generator script**

Create `scripts/generate-schema-sql.mjs`:

```js
#!/usr/bin/env node
// One-off generator: spin up an in-memory SQLite, use drizzle-kit's push
// mechanism (via a temp config), then dump the resulting schema.
//
// Usage: node scripts/generate-schema-sql.mjs
//
// This is called from `pnpm --filter @workspace/db run db:schema-sql`.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tempDb = path.join(os.tmpdir(), `schema-gen-${process.pid}.sqlite`);
const outFile = path.resolve(repoRoot, "lib/db/src/schema.sql");

console.log(`Spinning up temp DB at ${tempDb}`);
try {
  if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);

  // Push the current Drizzle schema into the temp DB using drizzle-kit.
  execSync(
    `pnpm --filter @workspace/db exec drizzle-kit push --force --config ./drizzle.config.ts`,
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: `file:${tempDb}` },
      stdio: "inherit",
    },
  );

  // Open the temp DB and dump the schema from sqlite_master.
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(tempDb);
  const rows = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name ASC",
    )
    .all();
  db.close();

  const header = `-- Generated by scripts/generate-schema-sql.mjs.
-- DO NOT EDIT BY HAND.
-- Regenerate with: pnpm --filter @workspace/db run db:schema-sql
`;
  const body = rows.map((r) => `${r.sql};`).join("\n\n");
  fs.writeFileSync(outFile, `${header}\n${body}\n`);
  console.log(`Wrote ${outFile}`);
} finally {
  if (fs.existsSync(tempDb)) {
    try { fs.unlinkSync(tempDb); } catch (e) { /* ignore */ }
  }
}
```

- [ ] **Step 2: Add the script entry**

In `lib/db/package.json`, add to `scripts`:
```json
"db:schema-sql": "node ../../scripts/generate-schema-sql.mjs"
```

- [ ] **Step 3: Run the generator**

```bash
pnpm --filter @workspace/db run db:schema-sql
```

Expected: drizzle-kit prints push output (it will say "No changes detected" against a fresh DB, then write the schema), and `lib/db/src/schema.sql` is created.

If push fails because `drizzle-kit` complains about `:memory:` or path issues, fallback: edit the script to write a `file:` URL with `tempDb` as a fully-qualified path. The env var `DATABASE_URL=file:${tempDb}` should already do this.

- [ ] **Step 4: Verify the schema.sql content**

```bash
head -30 lib/db/src/schema.sql
```

Expected output starts with the `-- Generated by` header, then `CREATE TABLE \`analyses\` (` and the column list. Should be ~80-120 lines total.

If empty or missing tables, abort. Check `drizzle-kit push` worked.

- [ ] **Step 5: Write the test-helpers module**

Create `lib/db/src/test-helpers.ts`:

```ts
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.join(__dirname, "schema.sql");

/**
 * Spin up a fresh isolated SQLite database with the current schema applied.
 * Returns the drizzle instance, raw sqlite handle, and a `close()` cleanup.
 *
 * Uses a process-pid + random suffix tmp file so tests across vitest forks
 * don't collide. Cleanup deletes the file on `close()`.
 */
export function createTestDb() {
  const id = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const dbPath = path.join(os.tmpdir(), `optimatch-test-${id}.sqlite`);

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const ddl = readFileSync(SCHEMA_SQL_PATH, "utf8");
  sqlite.exec(ddl);

  const db = drizzle(sqlite, { schema });

  const close = () => {
    try { sqlite.close(); } catch (e) { /* ignore */ }
    try {
      const fs = require("node:fs");
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    } catch (e) { /* ignore */ }
  };

  return { db, sqlite, dbPath, close };
}
```

- [ ] **Step 6: Add subpath export to lib/db**

Edit `lib/db/package.json`. The `exports` field currently looks like:
```json
"exports": {
  ".": "./src/index.ts",
  "./schema": "./src/schema/index.ts"
}
```

Add a third entry:
```json
"exports": {
  ".": "./src/index.ts",
  "./schema": "./src/schema/index.ts",
  "./test-helpers": "./src/test-helpers.ts"
}
```

- [ ] **Step 7: Typecheck**

```bash
pnpm run typecheck
```
Every workspace `Done`.

- [ ] **Step 8: Commit**

```bash
git add scripts/generate-schema-sql.mjs lib/db/src/schema.sql lib/db/src/test-helpers.ts lib/db/package.json
git commit -m "chore(db): generate schema.sql and add createTestDb helper"
```

---

## Task 3: Add lib/api-zod and lib/db tests

**Files:**
- Create: `lib/api-zod/vitest.config.ts`
- Create: `lib/api-zod/src/index.test.ts`
- Create: `lib/db/vitest.config.ts`
- Create: `lib/db/src/schema.test.ts`
- Create: `vitest.workspace.ts` (root)

- [ ] **Step 1: Add root workspace config**

Create `vitest.workspace.ts`:

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "lib/api-zod/vitest.config.ts",
  "lib/db/vitest.config.ts",
  "artifacts/api-server/vitest.config.ts",
  "artifacts/resume-matcher/vitest.config.ts",
]);
```

- [ ] **Step 2: api-zod vitest config**

Create `lib/api-zod/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api-zod",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: api-zod test file**

Create `lib/api-zod/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CreateAnalysisBody } from "./index";

describe("CreateAnalysisBody schema", () => {
  it("accepts a valid payload", () => {
    const result = CreateAnalysisBody.safeParse({
      jobTitle: "Senior Frontend Engineer",
      resumeText: "Jane Smith\n5 years React experience",
      jobDescriptionText: "We are hiring a senior frontend engineer.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when jobTitle is missing", () => {
    const result = CreateAnalysisBody.safeParse({
      resumeText: "Jane Smith\n5 years React experience",
      jobDescriptionText: "We are hiring a senior frontend engineer.",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("jobTitle"))).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Run api-zod tests**

```bash
pnpm --filter @workspace/api-zod run test
```

Expected: 2 tests pass.

If `CreateAnalysisBody` isn't found, check whether the name is different in the generated zod. Run:
```bash
grep -n "export const Create" lib/api-zod/src/generated/api.ts | head -3
```
Use whatever the actual export name is (most likely `CreateAnalysisBody` per sub-project 1's cleanup).

- [ ] **Step 5: lib/db vitest config**

Create `lib/db/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "db",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: lib/db schema test**

Create `lib/db/src/schema.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { analyses, insertAnalysisSchema } from "./schema/analyses";
import { createTestDb } from "./test-helpers";

describe("analyses schema", () => {
  let ctx: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    ctx = createTestDb();
  });

  afterEach(() => {
    ctx.close();
  });

  it("inserts a row with all required fields", () => {
    const { db } = ctx;
    const result = db
      .insert(analyses)
      .values({
        jobTitle: "Engineer",
        resumeText: "resume content",
        jobDescriptionText: "job description content",
        fitScore: 80,
        fitRationale: "good fit",
        atsScore: 75,
      })
      .run();
    expect(result.changes).toBe(1);
  });

  it("rejects insert without jobTitle via drizzle-zod", () => {
    const result = insertAnalysisSchema.safeParse({
      resumeText: "resume",
      jobDescriptionText: "jd",
      fitScore: 80,
      fitRationale: "x",
      atsScore: 75,
    });
    expect(result.success).toBe(false);
  });

  it("applies json/default values on insert", () => {
    const { db } = ctx;
    db.insert(analyses)
      .values({
        jobTitle: "Engineer",
        resumeText: "resume",
        jobDescriptionText: "jd",
        fitScore: 80,
        fitRationale: "x",
        atsScore: 75,
      })
      .run();

    const rows = db.select().from(analyses).all();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.strengths).toEqual([]);
    expect(row.gaps).toEqual([]);
    expect(row.improvements).toEqual([]);
    expect(row.atsKeywordsMatched).toEqual([]);
    expect(row.atsKeywordsMissing).toEqual([]);
    expect(row.tags).toEqual([]);
    expect(row.portfolioLinks).toEqual([]);
    expect(row.status).toBe("not_applied");
    expect(row.isFavorite).toBe(false);
    expect(row.isPublic).toBe(false);
  });
});
```

- [ ] **Step 7: Run lib/db tests**

```bash
pnpm --filter @workspace/db run test
```

Expected: 3 tests pass.

If a test fails because the `insertAnalysisSchema` export name is different, check it:
```bash
grep "export const insertAnalysisSchema\|export const analyses" lib/db/src/schema/analyses.ts
```
Adjust the import accordingly.

- [ ] **Step 8: Commit**

```bash
git add vitest.workspace.ts \
        lib/api-zod/vitest.config.ts lib/api-zod/src/index.test.ts \
        lib/db/vitest.config.ts lib/db/src/schema.test.ts
git commit -m "test(api-zod,db): schema validation and integrity tests"
```

---

## Task 4: Add api-server route tests

**Files:**
- Create: `artifacts/api-server/vitest.config.ts`
- Create: `artifacts/api-server/src/test/setup.ts`
- Create: `artifacts/api-server/src/routes/health.test.ts`
- Create: `artifacts/api-server/src/routes/analyses.test.ts`

- [ ] **Step 1: api-server vitest config**

Create `artifacts/api-server/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "api-server",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ["src/test/setup.ts"],
  },
});
```

`singleFork: true` ensures all api-server tests share one Vitest process. This avoids the `lib/db/src/index.ts` module-level DB opening from being re-evaluated per test file. Tests use `beforeEach` to reset the DB state.

- [ ] **Step 2: api-server test setup**

Create `artifacts/api-server/src/test/setup.ts`:

```ts
import { beforeAll, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// CRITICAL: set DATABASE_URL BEFORE any @workspace/db import. Vitest setup
// files run before test modules' top-level imports.
const testDbPath = path.join(os.tmpdir(), `optimatch-test-api-${process.pid}.sqlite`);
process.env.DATABASE_URL = `file:${testDbPath}`;

// Now safe to import @workspace/db.
const { db, analyses, notifications } = await import("@workspace/db");

// Apply the schema once at startup.
beforeAll(() => {
  const schemaPath = path.resolve(
    __dirname,
    "../../../../lib/db/src/schema.sql",
  );
  const ddl = fs.readFileSync(schemaPath, "utf8");
  // drizzle better-sqlite3 exposes the underlying Database via $client.
  const sqlite = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
  sqlite.exec(ddl);
});

beforeEach(() => {
  // Clear all tables between tests.
  const sqlite = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
  sqlite.exec("DELETE FROM notifications; DELETE FROM analyses;");
});

// Best-effort cleanup of the tmp DB on process exit.
process.on("exit", () => {
  try { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); } catch (e) { /* ignore */ }
  try { if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`); } catch (e) { /* ignore */ }
  try { if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`); } catch (e) { /* ignore */ }
});

export { db, analyses, notifications };
```

Note: `__dirname` is available because Vitest defaults to CommonJS-compatible module resolution OR provides shims. If `__dirname` is undefined at runtime (pure ESM), add at the top:
```ts
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

- [ ] **Step 3: Health test**

Create `artifacts/api-server/src/routes/health.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /api/healthz", () => {
  it("returns 200 with a JSON body", async () => {
    const response = await request(app).get("/api/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });
});
```

- [ ] **Step 4: Run health test**

```bash
pnpm --filter @workspace/api-server run test
```

Expected: 1 test passes. If it fails due to env issues, check `process.env.DATABASE_URL` was set before `@workspace/db` was imported.

If you see "Cannot find module '@workspace/db'" during the setup file, the path resolution may differ — adjust the dynamic import path.

- [ ] **Step 5: Analyses routes test**

Create `artifacts/api-server/src/routes/analyses.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { db, analyses } from "@workspace/db";

function insertAnalysis(overrides: Partial<typeof analyses.$inferInsert> = {}) {
  const base = {
    jobTitle: "Engineer",
    resumeText: "resume",
    jobDescriptionText: "jd",
    fitScore: 80,
    fitRationale: "fits well",
    atsScore: 75,
  };
  const result = db
    .insert(analyses)
    .values({ ...base, ...overrides })
    .returning()
    .all();
  return result[0]!;
}

describe("GET /api/analyses", () => {
  it("returns an empty array when the DB is empty", async () => {
    const response = await request(app).get("/api/analyses");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns inserted rows in createdAt desc order", async () => {
    insertAnalysis({ jobTitle: "Older" });
    // Small delay so createdAt timestamps differ.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    insertAnalysis({ jobTitle: "Newer" });

    const response = await request(app).get("/api/analyses");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].jobTitle).toBe("Newer");
    expect(response.body[1].jobTitle).toBe("Older");
  });
});

describe("GET /api/analyses/:id", () => {
  it("returns 404 when the analysis does not exist", async () => {
    const response = await request(app).get("/api/analyses/9999");
    expect(response.status).toBe(404);
  });

  it("returns the row when present", async () => {
    const inserted = insertAnalysis({ jobTitle: "Findable" });
    const response = await request(app).get(`/api/analyses/${inserted.id}`);
    expect(response.status).toBe(200);
    expect(response.body.jobTitle).toBe("Findable");
  });
});

describe("DELETE /api/analyses/:id", () => {
  it("deletes the row", async () => {
    const inserted = insertAnalysis({ jobTitle: "ToDelete" });
    const deleteResponse = await request(app).delete(`/api/analyses/${inserted.id}`);
    expect(deleteResponse.status).toBe(200);

    const getResponse = await request(app).get(`/api/analyses/${inserted.id}`);
    expect(getResponse.status).toBe(404);
  });
});

describe("PATCH /api/analyses/:id", () => {
  it("updates editable fields", async () => {
    const inserted = insertAnalysis({ jobTitle: "Patchable" });
    const response = await request(app)
      .patch(`/api/analyses/${inserted.id}`)
      .send({ isFavorite: true, notes: "loved this role" });
    expect(response.status).toBe(200);

    const getResponse = await request(app).get(`/api/analyses/${inserted.id}`);
    expect(getResponse.body.isFavorite).toBe(true);
    expect(getResponse.body.notes).toBe("loved this role");
  });
});

describe("POST /api/analyses/:id/duplicate", () => {
  it("clones the row with a new id", async () => {
    const inserted = insertAnalysis({ jobTitle: "Original" });
    const response = await request(app).post(`/api/analyses/${inserted.id}/duplicate`);
    expect(response.status).toBe(200);
    expect(response.body.id).not.toBe(inserted.id);
    expect(response.body.jobTitle).toBe("Original");
  });
});

describe("Share flow", () => {
  it("issues a token, returns the analysis via /share/:token, then revokes it", async () => {
    const inserted = insertAnalysis({ jobTitle: "Shareable" });

    const shareResponse = await request(app).post(`/api/analyses/${inserted.id}/share`);
    expect(shareResponse.status).toBe(200);
    expect(typeof shareResponse.body.shareUrl).toBe("string");
    // Extract token from share URL (format: ".../share/:token").
    const token = (shareResponse.body.shareUrl as string).split("/share/")[1];
    expect(token).toBeTruthy();

    const fetchResponse = await request(app).get(`/api/share/${token}`);
    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.jobTitle).toBe("Shareable");

    const revokeResponse = await request(app).delete(`/api/analyses/${inserted.id}/share`);
    expect(revokeResponse.status).toBe(200);

    const afterRevoke = await request(app).get(`/api/share/${token}`);
    expect(afterRevoke.status).toBe(404);
  });
});
```

The share test assumes the response body has `shareUrl` shaped as `…/share/<token>`. If the actual response uses a different field (e.g. `token` directly), the implementer should grep the route handler in `artifacts/api-server/src/routes/analyses.ts` around line 715 (`/analyses/:id/share`) and adjust.

- [ ] **Step 6: Run all api-server tests**

```bash
pnpm --filter @workspace/api-server run test
```

Expected: 9 tests pass (1 health + 8 analyses).

If individual tests fail because of route shape differences (e.g., the share endpoint returns a different shape), inspect the actual route handler in `artifacts/api-server/src/routes/analyses.ts` and adjust the test assertion to match the real behavior. Don't change the route — change the test.

- [ ] **Step 7: Run full test suite from root**

```bash
pnpm run test
```

Expected: 14 tests pass (2 api-zod + 3 db + 9 api-server). Vitest workspace mode reports per-project.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/vitest.config.ts artifacts/api-server/src/test/setup.ts artifacts/api-server/src/routes/health.test.ts artifacts/api-server/src/routes/analyses.test.ts
git commit -m "test(api-server): supertest route tests for health, analyses CRUD, share flow"
```

---

## Task 5: Frontend vitest config (no tests yet) + CI workflow

**Files:**
- Create: `artifacts/resume-matcher/vitest.config.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Frontend vitest config**

Create `artifacts/resume-matcher/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    name: "resume-matcher",
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

No test files; the runner just discovers nothing and reports 0. That's expected and acceptable.

- [ ] **Step 2: CI workflow**

Create `.github/workflows/ci.yml`:

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
        name: Install dependencies

      - run: pnpm run typecheck
        name: Typecheck

      - run: pnpm run test
        name: Tests

      - run: pnpm run build
        name: Build
```

- [ ] **Step 3: README Testing section**

Open `README.md`. Find the "Development" section (search for `## Development`). Just AFTER the existing Development section and BEFORE the next major heading, insert a new `## Testing` section:

```markdown
## Testing

We use [Vitest](https://vitest.dev) for unit and integration tests. The runner is configured as a workspace project across `lib/api-zod`, `lib/db`, `artifacts/api-server`, and `artifacts/resume-matcher`.

```bash
# Run all tests once
pnpm run test

# Watch mode
pnpm run test:watch

# Run a single workspace's tests
pnpm --filter @workspace/api-server run test
```

API server tests use a temp-file SQLite per test process. The schema is materialized from `lib/db/src/schema.sql`, which is generated from the Drizzle schema via:

```bash
pnpm --filter @workspace/db run db:schema-sql
```

Regenerate `schema.sql` whenever you change `lib/db/src/schema/*.ts`.
```

- [ ] **Step 4: Final typecheck + test run**

```bash
pnpm run typecheck
pnpm run test
```

Both must pass cleanly. Test count: 14.

- [ ] **Step 5: Commit**

```bash
git add artifacts/resume-matcher/vitest.config.ts .github/workflows/ci.yml README.md
git commit -m "chore(ci): GitHub Actions workflow gating typecheck + tests + build"
```

---

## Task 6: Verify + push + open PR

**Files:** (verification only)

- [ ] **Step 1: Final state check**

```bash
git log --oneline b77e666..HEAD
# Expected: 5 commits (chore(deps), chore(db), test(api-zod,db), test(api-server), chore(ci))

pnpm run typecheck 2>&1 | tail -5
# Expected: every workspace `Done`

pnpm run test 2>&1 | tail -10
# Expected: 14 tests passed (2 + 3 + 9)

pnpm run build 2>&1 | tail -5
# Expected: build succeeds across artifacts
```

If `pnpm run build` fails with an unrelated pre-existing issue, document it in the PR description; don't try to fix in this PR.

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin chore/testing-and-ci
gh pr create --base main --head chore/testing-and-ci \
  --title "chore: testing infrastructure + CI gates" \
  --body "$(cat <<'PRBODY'
## Summary

Phase 3 items 8+9 from the improvements list. Brings the repo from zero tests + no CI gates to:
- Vitest workspace setup across api-zod, lib/db, api-server, resume-matcher
- 14 tests covering schema validation, DB integrity, and API route handlers
- GitHub Actions workflow gating typecheck + tests + build on every PR

**Spec:** `docs/superpowers/specs/2026-06-30-testing-and-ci-design.md`
**Plan:** `docs/superpowers/plans/2026-06-30-testing-and-ci.md`

## What's covered

| Workspace | Tests | What |
|---|---|---|
| `lib/api-zod` | 2 | `CreateAnalysisBody` Zod schema validation |
| `lib/db` | 3 | `analyses` insert / required fields / defaults |
| `artifacts/api-server` | 9 | GET/POST/PATCH/DELETE /api/analyses, duplicate, share flow, healthz |

Tests use a temp-file SQLite per Vitest process, schema applied from a checked-in `lib/db/src/schema.sql` (generated via `pnpm --filter @workspace/db run db:schema-sql`).

## What's NOT covered yet

- AI-gated routes (cover-letter, salary-guide, etc.) — need mocked AI client, deferred to Phase 3 item 10
- Frontend component tests — Vitest configured for resume-matcher but no tests added
- E2E browser tests — separate sub-project
- Coverage thresholds — not enforced

## Test plan

- [x] `pnpm install` works on a fresh checkout
- [x] `pnpm run test` reports 14/14 passing locally
- [x] `pnpm run typecheck` is clean
- [x] `pnpm run build` succeeds
- [ ] CI workflow runs on this PR and passes (this PR is the first to trigger it)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

Watch the PR for CI results. The CI workflow is in this PR, so it will run on this PR for the first time. If anything fails Linux-specific, investigate.

- [ ] **Step 3: Done**

No further commit. 5 commits + 1 PR.

---

## Done

5 commits. Repo has a real test safety net + CI gates. Next remaining items from the improvements list: 10 (AI hardening), 11 (observability), 12 (Drizzle migrations).
