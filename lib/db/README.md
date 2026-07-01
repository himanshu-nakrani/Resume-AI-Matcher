# @workspace/db

SQLite-backed data layer using Drizzle ORM. Schema lives in `src/schema/`; migrations are versioned SQL files under `drizzle/`.

## Adding a column or table

1. Edit the relevant file under `src/schema/` (or create a new one and export it from `src/schema/index.ts`).
2. Regenerate migrations:

   ```bash
   pnpm --filter @workspace/db run generate
   ```

   Drizzle will write a new file `drizzle/000N_<slug>.sql` with the SQL diff and update `drizzle/meta/`.
3. Review the generated SQL. For simple column adds, no manual work is needed. For renames, splits, or non-trivial data transforms, hand-edit the file.
4. Regenerate the test schema snapshot:

   ```bash
   pnpm --filter @workspace/db run db:schema-sql
   ```

   This applies every migration to a temp DB and dumps `sqlite_master` to `src/schema.sql`. Tests use it via `createTestDb`.
5. Run tests:

   ```bash
   pnpm --filter @workspace/db run test
   ```
6. Commit the schema TS file, the new migration SQL, the updated `meta/` files, and `schema.sql`.

## How migrations run

`runMigrations(db, sqlite)` runs at api-server startup, before `app.listen(...)`. It:

1. Detects "pre-migrations" databases (populated via legacy `drizzle-kit push`) — they have app tables but no `__drizzle_migrations` table. If detected, stamps `0000_initial` as applied without re-running DDL.
2. Delegates to `drizzle-orm/better-sqlite3/migrator` which applies every unapplied migration in journal order.

## Rules

- **Never edit an already-committed migration.** Add a new one that undoes/adjusts it. Editing changes its sha256 and the migrator will refuse to start.
- **Never run `drizzle-kit push`.** The command is removed from scripts. Use `generate`.
- **Schema TS and migration SQL travel together in the same commit.** Otherwise `db:schema-sql` output diverges from what runtime applies.
