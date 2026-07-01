import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the migrations folder. When this module runs from source
 * (`lib/db/dist/migrate.js`), it lives one directory above at `lib/db/drizzle`.
 * When api-server is bundled with esbuild, `import.meta.url` points at the
 * bundle output (`artifacts/api-server/dist/index.mjs`), so the relative path
 * misses. Walk up to the workspace root and land at `lib/db/drizzle`.
 */
function resolveMigrationsFolder(): string {
  const relative = path.resolve(__dirname, "..", "drizzle");
  if (existsSync(relative)) return relative;

  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.join(dir, "lib", "db", "drizzle");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return relative;
}

const MIGRATIONS_FOLDER = resolveMigrationsFolder();

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
  // Compute the hash BEFORE mutating state — if the migrations folder is
  // unresolvable we want to fail loudly without leaving a half-created
  // __drizzle_migrations table (which would then look like "already baselined"
  // on the next boot and cause the migrator to try re-applying 0000).
  const hash = readBaselineHash();
  const stamp = sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at NUMERIC
      );
    `);
    sqlite
      .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
      .run(hash, Date.now());
  });
  stamp();
}

function readBaselineHash(): string {
  const sqlPath = path.join(MIGRATIONS_FOLDER, "0000_initial.sql");
  const sql = readFileSync(sqlPath, "utf8");
  return createHash("sha256").update(sql).digest("hex");
}
