import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function defaultSqlitePath(): string {
  return path.join(findWorkspaceRoot(), "resume-matcher.sqlite");
}

function resolveSqliteDatabasePath(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return defaultSqlitePath();
  if (raw.startsWith("postgres://") || raw.startsWith("postgresql://")) {
    throw new Error(
      "This workspace uses SQLite. Unset the Postgres URL or set DATABASE_URL to a SQLite file, e.g. file:./resume-matcher.sqlite",
    );
  }
  const root = findWorkspaceRoot();
  if (raw.startsWith("file:")) {
    return fileURLToPath(new URL(raw, pathToFileURL(path.join(root, "/"))));
  }
  return path.resolve(root, raw);
}

const databasePath = resolveSqliteDatabasePath();
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const sqlite: Database.Database = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
export { runMigrations } from "./migrate";
export * from "./schema";
