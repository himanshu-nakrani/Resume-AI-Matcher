import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { runMigrations } from "./migrate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.resolve(__dirname, "schema.sql");

const TABLES = [
  "analyses",
  "conversations",
  "messages",
  "notifications",
  "saved_jobs",
  "search_alerts",
];

function tempDbPath(): string {
  return path.join(
    tmpdir(),
    `migrate-test-${process.pid}-${Math.random().toString(36).slice(2)}.sqlite`,
  );
}

describe("runMigrations", () => {
  let dbPath: string;
  let sqlite: Database.Database;

  beforeEach(() => {
    dbPath = tempDbPath();
    sqlite = new Database(dbPath);
    sqlite.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    sqlite.close();
    if (existsSync(dbPath)) unlinkSync(dbPath);
  });

  it("applies all migrations on a fresh database", () => {
    const db = drizzle(sqlite);
    runMigrations(db, sqlite);

    for (const table of TABLES) {
      const row = sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);
      expect(row).toBeDefined();
    }

    const migrationsRow = sqlite
      .prepare("SELECT COUNT(*) as n FROM __drizzle_migrations")
      .get() as { n: number };
    expect(migrationsRow.n).toBe(1);
  });

  it("stamps baseline on a pre-migrations database without re-running DDL", () => {
    sqlite.exec(readFileSync(SCHEMA_SQL_PATH, "utf8"));
    sqlite
      .prepare(
        `INSERT INTO analyses (
          job_title, resume_text, job_description_text,
          fit_score, fit_rationale, strengths, gaps, improvements,
          ats_keywords_matched, ats_keywords_missing, ats_score,
          tags, portfolio_links
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "Test Job",
        "resume",
        "jd",
        80,
        "ok",
        "[]",
        "[]",
        "[]",
        "[]",
        "[]",
        90,
        "[]",
        "[]",
      );

    const db = drizzle(sqlite);
    expect(() => runMigrations(db, sqlite)).not.toThrow();

    const migrationsRow = sqlite
      .prepare("SELECT COUNT(*) as n FROM __drizzle_migrations")
      .get() as { n: number };
    expect(migrationsRow.n).toBe(1);

    const dataRow = sqlite
      .prepare("SELECT COUNT(*) as n FROM analyses")
      .get() as { n: number };
    expect(dataRow.n).toBe(1);
  });

  it("is idempotent — calling runMigrations twice keeps exactly one row", () => {
    const db = drizzle(sqlite);
    runMigrations(db, sqlite);
    runMigrations(db, sqlite);

    const migrationsRow = sqlite
      .prepare("SELECT COUNT(*) as n FROM __drizzle_migrations")
      .get() as { n: number };
    expect(migrationsRow.n).toBe(1);
  });
});
