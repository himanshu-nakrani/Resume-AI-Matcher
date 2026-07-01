import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.resolve(__dirname, "..", "drizzle");

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
  sqlite.exec(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    );
  `);
  const hash = readBaselineHash();
  sqlite
    .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
    .run(hash, Date.now());
}

function readBaselineHash(): string {
  const sqlPath = path.join(MIGRATIONS_FOLDER, "0000_initial.sql");
  const sql = readFileSync(sqlPath, "utf8");
  return createHash("sha256").update(sql).digest("hex");
}
