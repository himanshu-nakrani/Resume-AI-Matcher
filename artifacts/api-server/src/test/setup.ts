import { beforeAll, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CRITICAL: set DATABASE_URL BEFORE any @workspace/db import. Vitest's
// setupFiles run before test modules' top-level imports of the same process.
const testDbPath = path.join(os.tmpdir(), `optimatch-test-api-${process.pid}.sqlite`);
// Wipe any leftover from a prior killed run.
for (const suffix of ["", "-shm", "-wal"]) {
  const file = `${testDbPath}${suffix}`;
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) { /* ignore */ }
}
process.env.DATABASE_URL = `file:${testDbPath}`;

// Now safe to import @workspace/db.
const { db } = await import("@workspace/db");

const sqliteClient = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;

// Apply schema once at startup.
beforeAll(() => {
  const schemaPath = path.resolve(__dirname, "../../../../lib/db/src/schema.sql");
  const ddl = fs.readFileSync(schemaPath, "utf8");
  sqliteClient.exec(ddl);
});

beforeEach(() => {
  // Clear all tables between tests so each test starts with empty state.
  // Order matters when foreign keys exist; messages depends on conversations,
  // search_alerts/saved_jobs are independent, notifications references analyses,
  // so delete in reverse-dep order.
  sqliteClient.exec(
    "DELETE FROM messages; DELETE FROM conversations; DELETE FROM notifications; DELETE FROM analyses; DELETE FROM saved_jobs; DELETE FROM search_alerts;",
  );
});

// Best-effort cleanup of the tmp DB on process exit.
process.on("exit", () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    const file = `${testDbPath}${suffix}`;
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});
