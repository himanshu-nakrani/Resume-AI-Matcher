# Drizzle Migrations

**Date:** 2026-07-01
**Status:** Approved for implementation
**Scope:** Phase 3 item 12 from the "improvements 1-12" list.

## Goal

Replace destructive `drizzle-kit push` with versioned, auto-applied SQL migrations. Preserve the current dev UX (clone → run) and existing populated databases (populated via `push` today).

## Decisions

| Question | Decision |
|---|---|
| When migrations run | Auto at api-server startup, before `app.listen()` |
| Baseline strategy | Generate `0000_initial.sql`; migrator detects "pre-migrations" DBs and stamps the baseline as applied without re-running |
| Legacy `push` scripts | Removed. `schema.sql` stays for tests but is regenerated **from applied migrations** instead of `push` |
| Authoring flow | `drizzle-kit generate` — edit schema TS, run generator, review + commit both TS and SQL |
| Down migrations | Out of scope (SQLite forward-only) |
| Multi-DB / Postgres | Out of scope |

## Architecture

Three components, all in `lib/db`:

1. **Migration files** — SQL under `lib/db/drizzle/` (drizzle-kit's default output). Generated from the TS schema.
2. **Runtime migrator** — `lib/db/src/migrate.ts` exports `runMigrations(db)`. Handles the baseline case (existing DBs already at current schema) and delegates to `drizzle-orm/better-sqlite3/migrator` for the normal path.
3. **api-server integration** — `artifacts/api-server/src/index.ts` calls `runMigrations(db)` before `app.listen()`.

## Migration file layout

```
lib/db/
  drizzle/
    0000_initial.sql          ← full CREATE TABLE dump of current schema
    meta/
      _journal.json           ← drizzle's migration index
      0000_snapshot.json      ← drizzle's schema snapshot for diffing
```

`0000_initial.sql` is generated once from the current TS schema (via `drizzle-kit generate` on empty history) and mirrors what today's `schema.sql` contains.

## Modules

### `lib/db/drizzle.config.ts` (modify)

Add `out: "./drizzle"` so `drizzle-kit generate` writes to the expected location. Keep dialect/schema paths.

```ts
export default defineConfig({
  schema: path.join(process.cwd(), "src/schema/index.ts"),
  dialect: "sqlite",
  out: "./drizzle",
  dbCredentials: { url },
});
```

### `lib/db/src/migrate.ts` (new)

```ts
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, "..", "drizzle");

/**
 * Apply all pending migrations. Handles three cases:
 *   1. Fresh DB       — no tables; migrator creates everything from 0000.
 *   2. Migrated DB    — __drizzle_migrations exists; migrator applies pending.
 *   3. Pre-migrations — schema exists but no __drizzle_migrations table
 *                       (populated via legacy `drizzle-kit push`). We stamp
 *                       0000 as applied without re-running its DDL.
 */
export function runMigrations(
  db: BetterSQLite3Database<Record<string, unknown>>,
  sqlite: Database.Database,
): void {
  if (needsBaseline(sqlite)) {
    stampBaseline(sqlite);
  }
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

function needsBaseline(sqlite: Database.Database): boolean {
  const hasAnalyses = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='analyses'")
    .get();
  const hasMigrationsTable = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'")
    .get();
  return Boolean(hasAnalyses) && !hasMigrationsTable;
}

function stampBaseline(sqlite: Database.Database): void {
  // Match drizzle's schema exactly so subsequent migrate() calls see the baseline row.
  sqlite.exec(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    );
  `);
  // Read the 0000 journal entry to get the exact hash. drizzle stores the hash
  // in _journal.json under `entries[].tag` (name) and computes it at migrate time
  // by hashing the SQL. Simpler: read the journal, insert a placeholder row with
  // the tag, and let the migrator's idempotence check skip re-applying.
  // Actually drizzle only checks `hash` (which is sha256 of the SQL string), so
  // we compute it here.
  const hash = readBaselineHash();
  sqlite
    .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
    .run(hash, Date.now());
}

function readBaselineHash(): string {
  // Compute sha256 of drizzle/0000_initial.sql exactly as drizzle-kit does.
  const sqlPath = path.join(MIGRATIONS_FOLDER, "0000_initial.sql");
  const sql = readFileSync(sqlPath, "utf8");
  return createHash("sha256").update(sql).digest("hex");
}
```

**Note on hash computation:** drizzle's migrator computes `sha256(sql)` for each migration file. If drizzle changes this algorithm between minor versions, the baseline stamp becomes wrong. Task 2's tests must verify the hash matches what a fresh `migrate()` computes.

### `lib/db/src/index.ts` (modify)

Re-export `runMigrations` and expose the raw `sqlite` handle alongside `db`:

```ts
export const db = drizzle(sqlite, { schema });
export { sqlite };
export { runMigrations } from "./migrate";
export * from "./schema";
```

### `artifacts/api-server/src/index.ts` (modify)

Call `runMigrations` before `app.listen(...)`:

```ts
import { db, sqlite, runMigrations } from "@workspace/db";

runMigrations(db, sqlite);

// ... existing setAiTokenRecorder, app.listen ...
```

### `lib/db/package.json` (modify)

```diff
- "push": "drizzle-kit push --config ./drizzle.config.ts",
- "push-force": "drizzle-kit push --force --config ./drizzle.config.ts",
+ "generate": "drizzle-kit generate --config ./drizzle.config.ts",
  "db:schema-sql": "node ../../scripts/generate-schema-sql.mjs",
  "test": "vitest run"
```

### `scripts/generate-schema-sql.mjs` (rewrite)

Change from "spin up temp DB + `push`" to "spin up temp DB + apply migrations":

```js
// Apply drizzle migrations to a temp DB, dump the resulting schema to lib/db/src/schema.sql.
// Use drizzle-orm's migrator (same code path as runtime) so the artifact matches what
// api-server produces at startup.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tempDb = path.join(os.tmpdir(), `schema-gen-${process.pid}.sqlite`);
const outFile = path.resolve(repoRoot, "lib/db/src/schema.sql");

try {
  if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);

  // Use a tiny inline runner to apply migrations against tempDb via better-sqlite3
  // and drizzle-orm's migrator (matches runtime behavior exactly).
  execSync(
    `pnpm --filter @workspace/db exec tsx -e "
      import Database from 'better-sqlite3';
      import { drizzle } from 'drizzle-orm/better-sqlite3';
      import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
      const db = new Database('${tempDb}');
      migrate(drizzle(db), { migrationsFolder: './drizzle' });
    "`,
    { cwd: repoRoot, stdio: "inherit" },
  );

  // Dump CREATE statements exactly as before.
  const { default: Database } = await import(
    new URL("../lib/db/node_modules/better-sqlite3/lib/index.js", import.meta.url).href
  );
  const db = new Database(tempDb);
  const rows = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY type DESC, name ASC",
    )
    .all();

  const header = `-- Generated by scripts/generate-schema-sql.mjs.\n-- DO NOT EDIT BY HAND.\n-- Regenerate with: pnpm --filter @workspace/db run db:schema-sql\n\n`;
  const body = rows.map((r) => `${r.sql};`).join("\n\n") + "\n";
  fs.writeFileSync(outFile, header + body);
  db.close();
  console.log(`Wrote ${outFile}`);
} finally {
  if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
}
```

**Key change:** the SELECT excludes `__drizzle_migrations` from the dump — that's a runtime table, not part of the app schema, and `createTestDb` shouldn't preload it.

### `lib/db/README.md` (new, short)

Authoring guide (~30 lines):
- How to add a column: edit schema TS → `pnpm --filter @workspace/db run generate` → review the new SQL file → run tests → commit both.
- How to add a new table: same flow.
- Rename / split: hand-edit the generated SQL.
- Regenerate `schema.sql` after any migration change: `pnpm --filter @workspace/db run db:schema-sql`.

## Migration generation (one-time bootstrap)

Before shipping this, run:

```bash
cd lib/db
pnpm exec drizzle-kit generate --config ./drizzle.config.ts
```

Expected output:
- `drizzle/0000_initial.sql` — full CREATE TABLE + CREATE INDEX statements
- `drizzle/meta/_journal.json` — `{ version: "7", dialect: "sqlite", entries: [{ idx: 0, version: "7", when: <ts>, tag: "0000_initial", breakpoints: true }] }`
- `drizzle/meta/0000_snapshot.json` — internal schema representation

Verify: extract `CREATE TABLE`/`CREATE INDEX` statements from `0000_initial.sql` and diff against current `lib/db/src/schema.sql`. They should be functionally identical (may differ in whitespace / statement order — that's fine).

## Tests (3 new, 29 total)

`lib/db/src/migrate.test.ts`:

1. **Fresh DB → all migrations applied**
   Create empty temp DB, call `runMigrations`, assert `analyses`, `conversations`, `messages`, `notifications`, `saved_jobs`, `search_alerts` all exist, plus `__drizzle_migrations` has one row.

2. **Pre-migrations DB → baseline stamped without re-running**
   Create temp DB, apply `schema.sql` raw (simulating legacy `push` state), call `runMigrations`, assert:
   - No error thrown (would fail if 0000 tried to re-CREATE TABLE)
   - `__drizzle_migrations` now exists with one row
   - Data in `analyses` (if any pre-seeded) is untouched

3. **Idempotent**
   Call `runMigrations` twice back-to-back on the same DB, assert `__drizzle_migrations` still has exactly one row after each call.

## Backward compatibility

- Existing DBs populated via `push` → baseline detected → seamless.
- Fresh clones → 0000 runs → seamless.
- `createTestDb` (`lib/db/src/test-helpers.ts`) — no change. It applies `schema.sql`, which is now generated from migrations but functionally identical. Existing 26 tests continue to pass.
- Anyone running the old `pnpm --filter @workspace/db run push` gets "command not found" — intended. They should use `generate` now.

## Files affected

```
Create: lib/db/drizzle/0000_initial.sql        (via drizzle-kit generate, committed)
Create: lib/db/drizzle/meta/_journal.json      (via drizzle-kit generate, committed)
Create: lib/db/drizzle/meta/0000_snapshot.json (via drizzle-kit generate, committed)
Create: lib/db/src/migrate.ts
Create: lib/db/src/migrate.test.ts
Create: lib/db/README.md
Modify: lib/db/drizzle.config.ts (add `out`)
Modify: lib/db/package.json (swap scripts)
Modify: lib/db/src/index.ts (export sqlite + runMigrations)
Modify: artifacts/api-server/src/index.ts (call runMigrations)
Modify: scripts/generate-schema-sql.mjs (apply migrations instead of push)
```

## Commits

5:
1. `chore(db): drizzle-kit generate config and 0000_initial migration`
2. `feat(db): runtime migrator with baseline detection`
3. `feat(api-server): run migrations at startup`
4. `chore(db): swap push scripts for generate, rewrite schema-sql generator`
5. `docs(db): authoring guide for schema changes`

## Non-goals

- Down migrations (SQLite forward-only is standard; column drops require table recreate anyway)
- Multi-tenant / multi-DB coordination
- Postgres migration path
- Backup / restore before migration (single-user local app; user's responsibility)
- CI check that migrations are up-to-date with schema TS (nice-to-have; deferred)

## Risks

| Risk | Mitigation |
|---|---|
| `0000_initial.sql` diverges from current schema | After generation, diff extracted CREATE statements against current `schema.sql` before committing. Functionally identical is required |
| drizzle changes hash algorithm between versions | Test 3 (idempotence) catches this — if the hash we stamp doesn't match what `migrate()` recomputes, it would try to re-apply and fail |
| Baseline detection misfires on partial DBs | Baseline path only fires when `__drizzle_migrations` is fully absent AND `analyses` exists. Anyone who has run this branch once has the migrations table, so the path becomes a no-op forever |
| `db:schema-sql` script depends on `tsx` inline execution | `tsx` is in the workspace catalog; the script uses `pnpm --filter @workspace/db exec` so resolution is stable |
| Migration file committed but hash drifts from disk | The hash we stamp is computed from the on-disk file at baseline time — if someone edits an applied migration, `migrate()` will fail loudly on next startup, which is the correct behavior |
| `__drizzle_migrations` table pollutes schema.sql dumps | `generate-schema-sql.mjs` explicitly excludes it from the SELECT |

## What "done" looks like

- Fresh DB: `pnpm --filter @workspace/api-server run dev` creates the file + applies 0000 + starts server
- Existing DB from `push`: same command detects baseline, stamps, starts server, no data loss
- 29 tests pass (26 existing + 3 migrator tests)
- `pnpm typecheck`, `pnpm test`, `pnpm build` all green
- `pnpm --filter @workspace/db run push` returns "command not found" (intentional)
- `pnpm --filter @workspace/db run generate` regenerates on schema TS edits
- `pnpm --filter @workspace/db run db:schema-sql` produces byte-identical (modulo whitespace) output to current schema.sql
