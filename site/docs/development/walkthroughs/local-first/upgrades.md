# Upgrades & Migration Mechanics

This page explains how schema migrations are rolled out to existing clients, how failures are detected and surfaced, and the tools available for debugging and recovery.

## Overview

Local-first schema evolution requires careful coordination:

- **Fresh installs** download a bundled migration suite (all migrations in one transaction).
- **Existing clients** receive migrations incrementally, one at a time, on app startup.
- **Every migration attempt** is recorded in a separate `_migration_log` audit table, immune to schema failures.
- **Migration failures** trigger a recovery overlay with error details and a "clear and reload" button.
- **The hot-tab problem** is solved by checking `/__health` for buildId mismatches, prompting users to reload safely, and recovering automatically when a stale chunk fails.
- **Destructive Preview migrations** must name their reset boundary and warn users about local-only data that the server cannot restore.

---

## How Migrations Work

### Migration Runner

The migration runner (`app/local-db/migrations.ts`) is the entry point for all local schema changes. It runs once on app startup, triggered by the bootstrap layer (`app/local-db/bootstrap.ts`).

```text
App startup
  ↓
Plugin: warmLocalDatabaseInBackground()
  ↓
bootstrap.ensureLocalDatabaseReady()
  ↓
migrations.initializeDatabase()
  ├─ migrationLog.ensure() — bootstrap _migration_log first
  ├─ ensureMigrationsTable() — CREATE TABLE IF NOT EXISTS _migrations
  ├─ getAppliedMigrationIds() — read _migrations table
  ├─ loadPendingMigrations() — filter out already-applied ones
  └─ applyMigration() or applyMigrationBundle()
       ├─ run SQL statements in a transaction
       ├─ insert into _migrations
       └─ record to _migration_log
```

### Bundled vs. Incremental

| Scenario | Behavior |
|----------|----------|
| Fresh install (no schema_version table) | Apply all migrations in a single `applyMigrationBundle()` transaction |
| Existing client (has schema_version table) | Apply each pending migration individually with `applyMigration()`, one per startup |

The bundled approach is faster for new users; the incremental approach avoids locking old clients on the first startup after a major version bump.

### Migration Content

Migrations are authored as SQL files in `shared/db/migrations/sqlite/` and registered in `shared/db/migrations/index.ts`. At build time, `pnpm migrations:generate-content` regenerates `shared/db/migrations/sqlite-content.ts`, which exports a JavaScript object mapping migration IDs to their SQL content. This bundled approach ensures:

- Migrations are repo-visible and code-reviewable.
- The browser never reads from the filesystem at runtime.
- The migration content is versioned with the deployment artifact.

---

## The `_migration_log` Audit Table

### Schema

```sql
CREATE TABLE _migration_log (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('applied', 'failed')),
  duration_ms INTEGER,
  error TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### Bootstrapping

The `_migration_log` table is created **before any Drizzle migrations run**, via `migrationLog.ensure()` in `app/local-db/migration-log.ts`. It uses raw SQLocal SQL and lives outside the main migration chain, so it can record failures even when the main schema is broken.

### Recording Attempts

Every migration attempt (success or failure) is recorded:

```typescript
// On success
await migrationLog.recordApplied(migrationId, durationMs);

// On failure
await migrationLog.recordFailed(migrationId, error);
```

### System Event

After a successful batch of migrations, the runner emits a `ClientSchemaMigrated.v1` domain event to the `events` table:

```typescript
{
  eventType: "ClientSchemaMigrated.v1",
  actorType: "system",
  actorId: "system",
  data: {
    migrationsApplied: ["0007_domain_events_rename_source_values"],
    schemaVersion: 7
  },
  source: "peaky.system"
}
```

This event is visible in the admin activity feed, giving operators visibility into when and which clients have upgraded.

### Debug Access

```javascript
// In the browser console, after the app has loaded:
await window.peakyDB.migrationLog()
// Returns an array of MigrationLogEntry objects with full history
```

---

## Migration Failures

### What Happens

If a migration fails (e.g., a table recreation encounters a constraint violation):

1. The transaction rolls back — no partial schema changes.
2. `migrationLog.recordFailed()` captures the error message.
3. The plugin (`app/plugins/local-db.client.ts`) catches the error and calls the `onError` callback.
4. The callback sets `useState('local-db-error')` to a reactive error state.
5. The error is persisted to `localStorage` so it survives a hard reload.
6. On the next render, `app.vue` displays a recovery overlay.

### Recovery Overlay

The overlay in `app.vue` shows:

- The error message in a monospaced block.
- Timestamp of when the error occurred.
- Two action buttons:
  - **Clear local data and reload** — sets `peaky-clear-db-on-reload` flag, triggers a reload, and the plugin deletes the OPFS database files before re-initializing.
  - **Copy error details** — copies a JSON payload with the error and `userAgent` to the clipboard for support.

Synced server data is not deleted by this browser action and can download again. However, the local database is not always only a cache: unpublished Template drafts are intentionally local-only and have no event, outbox, or server copy. **Clearing local data permanently deletes those drafts.** Export important drafts to Markdown before using recovery whenever Template Studio is still accessible.

### Why Persistent Error State?

If the error state were only in memory, a hard reload would lose it, and users would be stuck in a silent failure loop. By persisting to `localStorage`, the recovery overlay appears immediately, even if the user hard-refreshes before the plugin finishes initializing.

### The /system page is the recovery surface

Members don't need to wait for an emergency overlay to recover. The `/system` page (`app/pages/system.vue`) is available to every authenticated member and exposes a single Recreate-DB action under its Maintenance section. The flow:

1. Member clicks **Recreate local DB** on `/system`.
2. Confirmation modal surfaces the unsynced outbox count so the member can choose to wait for the next sync (every 30s). Waiting does not upload local-only Template drafts because they never enter the outbox.
3. The member exports any important unpublished Template draft to Markdown before continuing, if Template Studio remains accessible.
4. On confirm, the page sets the same `peaky-clear-db-on-reload` flag the recovery overlay uses and reloads. The plugin clears OPFS on the next mount.
5. After the rebuilt DB reaches `LocalDbReady.v1`, a `LocalDbRecreated.v1` system event is emitted with `triggeredBy: "user"` so the recreate moment is observable in the events feed.

Recovery copy must distinguish synced data from local-only authoring. It can promise that server data is not deleted and will download again, but it must also say that unpublished Template drafts in this browser will be permanently lost.

---

## The Blind Spot: E2E Tests Don't Catch Enum Drift

### The Problem

E2E tests always create a fresh database — they apply all migrations in a bundle and never exercise what happens when:

- A Drizzle enum column is changed in the schema (e.g., `text({ enum: ['old', 'new'] })`).
- An existing client tries to insert a value that doesn't match the `CHECK` constraint in the old table.

Result: silent corruption or runtime errors in production on users with stale client DBs.

### The Guard: Schema Contract Test

The test `tests/integration/migrations.test.ts > events CHECK constraints match the Drizzle schema enum values` is the deterministic defense:

```typescript
it("events CHECK constraints match the Drizzle schema enum values", () => {
  getDatabase();
  const sqlite = getSqlite()!;

  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'")
    .get() as { sql: string };

  const ddl = row.sql;

  // Assert every enum value from the Drizzle schema is in the CHECK constraint
  for (const value of actorType) {
    expect(ddl, `actor_type CHECK must include '${value}'`).toContain(`'${value}'`);
  }

  // ... and so on for other enums
});
```

This test:

1. Applies all migrations to a clean database.
2. Reads the `events` table DDL from `sqlite_master`.
3. Asserts that every enum value exported from `shared/db/schema/event.ts` is present in the CHECK constraint.

If a Drizzle enum is changed without a corresponding migration, the test fails at `pnpm test` time.

### When an Enum Changes

Whenever you update a Drizzle `text({ enum: [...] })` column, you **must** write a migration:

1. **Write SQL** in `shared/db/migrations/sqlite/0NNN_description.sql`:

   ```sql
   -- Create new table with updated CHECK constraint
   CREATE TABLE events_new (
     -- ... (same columns)
     actor_type TEXT NOT NULL CHECK(actor_type IN ('system', 'user', 'new-value')),
     -- ... (rest of columns)
   );

   -- Copy data
   INSERT INTO events_new
     SELECT * FROM events;

   -- Swap tables
   DROP TABLE events;
   ALTER TABLE events_new RENAME TO events;
   ```

2. **Register** the migration in `shared/db/migrations/index.ts`.

3. **Generate content** with `pnpm migrations:generate-content`.

4. **Verify** that `pnpm test` passes (the schema contract test will catch it if you missed a value).

---

## Destructive Preview reset for Template Revisions

The stable Template/Revision rollout intentionally resets the affected Preview data instead of attempting to reinterpret ambiguous legacy Template IDs as immutable Revision IDs. The two active migration authorities carry matching reset intent:

- runtime SQLite: `shared/db/migrations/sqlite/0016_template_revisions.sql`
- PostgreSQL: `services/internal/dbmigrate/migrations/008_template_revisions.sql`

Both remove existing Template and dependent Review domain rows before replacing `template_versions` and draft-specific tables with `template_revisions`, Revision Pillars/Questions, and exact `review_template_selections`. The reset includes Reviews, selections, answers, notes, attachment metadata, participants, scores, import/evidence records, and related audit and field-history rows. SQLite also clears matching outbox and pending-review queue rows plus entitlement snapshots. This is a destructive Preview migration, not a best-effort conversion; old Template and Review data is not recoverable from these databases after it applies.

The deletion manifest is scoped. Unrelated Product and Team subjects/profiles, catalog-directory rows, sync cursors, migration logs, and unrelated history or sync rows remain. Migration tests must prove both reset completeness and preservation of those unrelated rows.

!!! warning "Back up local-only drafts before upgrade"
    Unpublished Template drafts have no server or outbox copy. Export any draft you need as Markdown before a deployment that applies SQLite migration `0016`, before clearing site storage, or before recreating the local database. A normal reload does not erase OPFS data, but this migration and explicit database recreation do.

---

## Writing a Migration

### Step-by-Step

#### 1. Write the SQL file

Create `shared/db/migrations/sqlite/0008_description.sql`:

```sql
-- Example: adding a column with a default
ALTER TABLE subjects ADD COLUMN archived_at TEXT;

-- Example: adding a CHECK constraint to an existing column
-- (requires table recreation)
CREATE TABLE subjects_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'archived', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO subjects_new SELECT * FROM subjects;
DROP TABLE subjects;
ALTER TABLE subjects_new RENAME TO subjects;
```

#### 2. Register in `shared/db/migrations/index.ts`

```typescript
export const SQLITE_MIGRATIONS = [
  // ... existing migrations
  {
    id: "0008_description",
    downAt: "2026-04-01T00:00:00Z",
  },
];
```

#### 3. Regenerate migration content

```bash
pnpm migrations:generate-content
```

This reads the SQL files and updates `shared/db/migrations/sqlite-content.ts`.

#### 4. Verify tests pass

```bash
pnpm test
```

If you updated an enum column, the schema contract test (`migrations.test.ts`) will catch missing CHECK constraint values.

#### 5. Deploy

The migration will be bundled into the release artifact and automatically applied on client startup.

---

## The Hot-Tab Problem

### What It Is

A user has the app open in a tab, you deploy a new version with a schema change, and the user does not reload. The stale bundle still has the old schema shape in memory, but the server is now running the new version. Requests might fail silently, hit API mismatches, or request a deleted hashed Nuxt chunk.

### Proactive Build Detection

`app/composables/useDeploymentVersion.ts` checks `/__health` on mount and then every five minutes. The request uses `Cache-Control: no-cache` so the browser compares the bundle's build ID with the live server response rather than a cached value.

When the IDs differ, `app.vue` shows a dismissible banner:

```text
A new version of Peaky is available. [Reload now] [Dismiss]
```

Reload now calls `clearAndHardReload()` instead of `window.location.reload()`. It unregisters service workers, removes Cache Storage entries, clears session storage, and navigates with a cache-busting query parameter. The local OPFS database and Peaky identity/preferences remain intact.

### Reactive Chunk Recovery

An already-open tab can request a chunk from the previous deployment before the build check completes. Nuxt is configured to emit `app:chunkError`; `app/plugins/chunk-recovery.client.ts` handles that event with the same cache-safe reload path.

```text
Stale tab requests deleted chunk
  ↓
Nuxt emits app:chunkError
  ↓
Chunk recovery clears stale delivery state
  ↓
Cache-busted navigation loads current HTML and chunks
```

`shouldRecoverFromChunkError()` permits one automatic recovery attempt per minute. This prevents a persistent network or deployment error from causing a reload loop.

### In Development

The `/__health` endpoint returns `buildId: "dev"`, so no spurious reload prompts appear during local iteration.

---

## Debug Tools

All of these are available on `window.peakyDB` in the browser console:

| Tool | Purpose |
|------|---------|
| `window.peakyDB.isOpen()` | Check if the local database is ready |
| `window.peakyDB.getDB()` | Get the Drizzle database instance |
| `window.peakyDB.getSQLocal()` | Get the raw SQLocal client |
| `window.peakyDB.dumpTable(name, limit)` | Dump a table's contents (default 100 rows) |
| `window.peakyDB.getTables()` | List all tables (excluding system tables) |
| `window.peakyDB.stats()` | Row counts per table |
| `window.peakyDB.migrationLog()` | Full `_migration_log` history |
| `window.peakyDB.clearLocalData()` | Clear OPFS database and reload |

---

## PostgreSQL Schema Changes (Go backend)

The client SQLite schema and the PostgreSQL schema evolve independently. PostgreSQL uses `services/schema.sql`, Goose, and sqlc; runtime SQLite uses the hand-written `shared/db/schema/*.ts` tables and explicit SQLite migrations. Agreement is checked through persistence behavior tests, not generated across databases. The unused `scripts/generate-drizzle-from-sql.ts` and `shared/db/schema/generated/` path is legacy and non-authoritative: do not run, regenerate, or extend it.

Changing the PostgreSQL side requires three coordinated steps.

### Step 1 — Update `schema.sql`

`services/schema.sql` is the single source of truth for the PostgreSQL schema.
Edit it first so the intent is reviewable as a plain diff.

### Step 2 — Write a goose migration

Add a new numbered SQL file to `services/internal/dbmigrate/migrations/`:

```sql
-- 002_add_foo_column.sql
-- +goose Up
ALTER TABLE subjects ADD COLUMN foo TEXT;

-- +goose Down
ALTER TABLE subjects DROP COLUMN foo;
```

`peaky-ctl migrate` applies pending goose files at container startup.
There is no auto-rollback — write the `Down` section so on-call can revert
without a code change if needed.

### Step 3 — Update `queries.sql` and regenerate

If the schema change affects any column used by a query in
`services/internal/syncengine/repo/queries.sql`, update that file then run:

```bash
make gen:sqlc
```

This validates `queries.sql` against `schema.sql` at generation time and
rewrites `services/internal/syncengine/db/`. If a query references a column that no
longer exists, `sqlc generate` fails here — not at runtime in production.
Commit `queries.sql` and the regenerated `internal/syncengine/db/` together.

### Quick reference

```bash
make migrate:new NAME=add_foo_column   # scaffolds the numbered .sql file
```

| What changed | Steps |
| --- | --- |
| New table | `schema.sql` + migration file |
| New column on a queried table | `schema.sql` + migration file + `queries.sql` + `make gen:sqlc` |
| Column rename or drop | `schema.sql` + migration file + `queries.sql` + `make gen:sqlc` |
| New column on an unqueried table | `schema.sql` + migration file |

---

## Deployment Checklist

### SQLite client migration

- [ ] Schema change is authored as a new `.sql` file in `shared/db/migrations/sqlite/`.
- [ ] Migration is registered in `shared/db/migrations/index.ts`.
- [ ] `pnpm migrations:generate-content` has been run; commit the updated `sqlite-content.ts`.
- [ ] `pnpm test` passes, including the schema contract test.
- [ ] E2E tests pass (they exercise the full migration chain on a fresh DB).
- [ ] Enum value changes include explicit migration with updated CHECK constraints.
- [ ] Destructive migrations document the deletion manifest, prove unrelated-data preservation, and provide local-only data-loss warnings.
- [ ] Deployment includes the updated `sqlite-content.ts`.

### PostgreSQL backend migration

- [ ] `services/schema.sql` updated to reflect the intended end-state.
- [ ] New goose migration file added (`make migrate:new NAME=...`).
- [ ] If a queried column changed: `queries.sql` updated and `make gen:sqlc` run; regenerated `services/internal/syncengine/db/` committed alongside.
- [ ] `make test:go` passes.
- [ ] `make lint:go` passes.

---

## On-Call Runbook

### "Users report a database error overlay"

1. Check the admin activity feed for recent `ClientSchemaMigrated.v1` events — a recent migration rollout may have failed.
2. Ask a user to copy the error details (via the overlay's "Copy error details" button) and share with you.
3. Inspect the error message for the migration ID and error text.
4. Check `tests/unit/local-db/migrations.test.ts` to see if the schema contract test would have caught this (it should have).
5. If the error is unrecoverable, warn that clearing local data permanently deletes unpublished Template drafts, export them first when possible, then monitor synced data downloading from the server.

### "How do I rollback a bad migration?"

Rolling back a migration that's already applied to client databases is not straightforward — the `_migrations` table has recorded that it succeeded. Options:

1. **Never apply the bad migration in the first place** — catch it in code review and tests before deploying.
2. **Write a follow-up migration** that undoes the schema change and corrects the data. E2E tests will catch any mismatches.
3. **For pre-release deployments**, before merging to main, you can delete and re-create the migration files (since clients haven't applied them yet).

### "Our migration is taking a long time"

Check `window.peakyDB.migrationLog()` for the `duration_ms` of recent migrations. Large table transformations (recreating a table with millions of rows) can take seconds or longer. Consider:

- Breaking the migration into smaller steps across releases.
- Pre-computing large transformations on the server and syncing the result.
- Using a background migration path for non-critical schema changes.
