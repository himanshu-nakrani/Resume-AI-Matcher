import { readFileSync, existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database, { type Database as BetterSqliteDatabase } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.join(__dirname, "schema.sql");

export interface TestDb {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: BetterSqliteDatabase;
  dbPath: string;
  close: () => void;
}

/**
 * Spin up a fresh isolated SQLite database with the current schema applied.
 * Returns the drizzle instance, raw sqlite handle, the on-disk path, and a
 * `close()` cleanup that drops the file.
 *
 * Uses a process-pid + random suffix tmp file so tests across vitest forks
 * don't collide.
 */
export function createTestDb(): TestDb {
  const id = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const dbPath = path.join(os.tmpdir(), `optimatch-test-${id}.sqlite`);

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const ddl = readFileSync(SCHEMA_SQL_PATH, "utf8");
  sqlite.exec(ddl);

  const db = drizzle(sqlite, { schema });

  const close = () => {
    try {
      sqlite.close();
    } catch (e) {
      /* ignore */
    }
    for (const suffix of ["", "-shm", "-wal"]) {
      const file = `${dbPath}${suffix}`;
      try {
        if (existsSync(file)) unlinkSync(file);
      } catch (e) {
        /* ignore */
      }
    }
  };

  return { db, sqlite, dbPath, close };
}
