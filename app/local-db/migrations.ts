/**
 * Database migrations runner for local-first SQLite.
 *
 * Uses repo-visible SQL migration files shared with the server runtime.
 * Every migration attempt is recorded in _migration_log (a dedicated audit
 * table bootstrapped before the migration chain, immune to schema failures).
 * After a successful batch, a ClientSchemaMigrated.v1 system event is emitted
 * to events so the admin activity feed reflects schema rollouts.
 *
 * Formal model: formal_verification/storage/local_db_migration_idempotency.fizz —
 * changing the runner's status transitions or its re-entry paths (reload, OPFS
 * wipe) requires updating that spec.
 */

import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
  LATEST_SQLITE_MIGRATION_ID,
  SQLITE_MIGRATIONS_TABLE,
  splitMigrationStatements,
  shouldIncludeLegacyInlineMigration,
  type SQLiteMigration,
} from "#shared/db/migrations";
import { getSQLocal } from "./client";
import { migrationLog } from "./migration-log";
import { emitSystemEvent } from "~/services/events/emitSystemEvent";
import { sanitiseError } from "~/services/events/sanitiseError";
import type {
  ClientSchemaMigrated,
  LocalDbMigrationFailed,
} from "~/services/events/DomainEvent";

/** Schema version for standard migrations */
export const SCHEMA_VERSION = getSQLiteMigrations().length;

let migrationPromise: Promise<void> | null = null;

/**
 * Migrations applied in the most recent run.
 * Empty when no migrations were pending on startup.
 * Exposed so the bootstrap layer can emit the ClientSchemaMigrated event.
 */
let lastAppliedMigrations: string[] = [];

export function getLastAppliedMigrations(): string[] {
  return lastAppliedMigrations;
}

async function tableExists(tableName: string): Promise<boolean> {
  const client = await getSQLocal();
  const result = await client.sql<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    tableName
  );

  return result.length > 0;
}

async function getTableColumns(
  tableName: "entitlement_snapshots" | "pending_review_queue"
): Promise<Set<string>> {
  const client = await getSQLocal();
  const result = await client.sql<{ name: string }>(
    `PRAGMA table_info('${tableName}')`
  );

  return new Set(result.map((column) => column.name));
}

async function ensureMigrationsTable(): Promise<void> {
  const client = await getSQLocal();
  await client.sql(
    `CREATE TABLE IF NOT EXISTS ${SQLITE_MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );
}

async function getAppliedMigrationIds(): Promise<Set<string>> {
  const client = await getSQLocal();
  const rows = await client.sql<{ id: string }>(
    `SELECT id FROM ${SQLITE_MIGRATIONS_TABLE} ORDER BY id`
  );

  return new Set(rows.map((row) => row.id));
}

async function loadMigrationStatements(
  migration: SQLiteMigration
): Promise<string[]> {
  return splitMigrationStatements(getSQLiteMigrationSql(migration));
}

async function applyMigration(migration: SQLiteMigration): Promise<void> {
  const client = await getSQLocal();
  const statements = await loadMigrationStatements(migration);
  const startedAt = performance.now();

  try {
    // Execute migration SQL inside a transaction so DDL + DML are atomic.
    await client.transaction(async (tx) => {
      for (const statement of statements) {
        await tx.sql(statement);
      }
    });

    // Record the migration as applied in a SEPARATE autocommit statement.
    //
    // SQLite-WASM (SQLocal) can return SQLITE_SCHEMA when DML follows
    // schema-changing DDL (DROP TABLE / ALTER TABLE RENAME TO) inside the
    // same transaction, because each DDL increments the internal schema
    // version. Moving the tracking INSERT outside the DDL transaction avoids
    // this and ensures the record is committed even when the migration
    // contains multiple schema-version bumps.
    //
    // INSERT OR IGNORE makes re-runs harmless if a previous attempt committed
    // the DDL but not the tracking record.
    await client.sql(
      `INSERT OR IGNORE INTO ${SQLITE_MIGRATIONS_TABLE} (id) VALUES (?)`,
      migration.id
    );

    await migrationLog.recordApplied(
      migration.id,
      Math.round(performance.now() - startedAt)
    );
  } catch (error) {
    await migrationLog.recordFailed(migration.id, error as Error);
    await emitMigrationFailedEvent(migration.id, error);
    throw error;
  }
}

async function applyMigrationBundle(
  migrations: SQLiteMigration[]
): Promise<number> {
  const client = await getSQLocal();
  const statementGroups = await Promise.all(
    migrations.map(async (migration) => ({
      migration,
      statements: await loadMigrationStatements(migration),
    }))
  );
  const totalStatements = statementGroups.reduce((sum, entry) => {
    return sum + entry.statements.length;
  }, 0);

  const startedAt = performance.now();

  try {
    await client.transaction(async (tx) => {
      for (const { statements } of statementGroups) {
        for (const statement of statements) {
          await tx.sql(statement);
        }
      }

      for (const { migration } of statementGroups) {
        await tx.sql(
          `INSERT INTO ${SQLITE_MIGRATIONS_TABLE} (id) VALUES (?)`,
          migration.id
        );
      }
    });

    const durationMs = Math.round(performance.now() - startedAt);
    for (const { migration } of statementGroups) {
      await migrationLog.recordApplied(migration.id, durationMs);
    }
  } catch (error) {
    // Record failure against every migration in the bundle — the transaction
    // rolled back so none of them applied.
    for (const { migration } of statementGroups) {
      await migrationLog.recordFailed(migration.id, error as Error);
      await emitMigrationFailedEvent(migration.id, error);
    }
    throw error;
  }

  return totalStatements;
}

/**
 * Emit a LocalDbMigrationFailed.v1 event with a sanitised message.
 * Pairs with the `_migration_log` row that captured the same failure: the
 * event is the public-facing signal, the log is the local-only diagnostic.
 */
async function emitMigrationFailedEvent(
  migrationId: string,
  error: unknown
): Promise<void> {
  await emitSystemEvent<LocalDbMigrationFailed>({
    type: "LocalDbMigrationFailed.v1",
    entityId: migrationId,
    data: {
      migrationId,
      errorMessage: sanitiseError(error),
    },
  });
}

/**
 * Emit a ClientSchemaMigrated.v1 system event after a successful migration
 * run. `emitSystemEvent` itself imports `getDatabase` from `./client` (file,
 * not barrel) so this call stays off the circular path.
 */
async function emitSchemaMigratedEvent(appliedIds: string[]): Promise<void> {
  await emitSystemEvent<ClientSchemaMigrated>({
    type: "ClientSchemaMigrated.v1",
    entityId: "client",
    data: {
      migrationsApplied: appliedIds,
      schemaVersion: SCHEMA_VERSION,
    },
  });
}

/**
 * Run database migrations.
 * Called once when the database is first initialized.
 */
export async function runMigrations(): Promise<void> {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = runMigrationsOnce().catch((error) => {
    migrationPromise = null;
    throw error;
  });

  return migrationPromise;
}

async function runMigrationsOnce(): Promise<void> {
  // Bootstrap the migration audit log before anything else — it must survive
  // failures in the main migration chain.
  await migrationLog.ensure();
  await ensureMigrationsTable();

  const appliedMigrationIds = await getAppliedMigrationIds();
  const hasSchemaVersionTable = await tableExists("schema_version");
  const includeLegacyInline =
    appliedMigrationIds.size === 0 &&
    shouldIncludeLegacyInlineMigration({
      hasSchemaVersionTable,
      entitlementSnapshotColumns: hasSchemaVersionTable
        ? await getTableColumns("entitlement_snapshots")
        : undefined,
      pendingReviewQueueColumns: hasSchemaVersionTable
        ? await getTableColumns("pending_review_queue")
        : undefined,
    });

  if (
    appliedMigrationIds.size === 0 &&
    hasSchemaVersionTable &&
    !includeLegacyInline
  ) {
    console.warn(
      "[local-db] Found schema_version without the expected legacy inline table shape; skipping legacy client upgrade migration"
    );
  }

  const pendingMigrations = getSQLiteMigrations({
    includeLegacyInline,
  }).filter((migration) => !appliedMigrationIds.has(migration.id));

  if (pendingMigrations.length === 0) {
    lastAppliedMigrations = [];
    return;
  }

  console.log(
    `[local-db] Applying ${pendingMigrations.length} migration(s)${
      LATEST_SQLITE_MIGRATION_ID ? ` up to ${LATEST_SQLITE_MIGRATION_ID}` : ""
    }`
  );

  if (appliedMigrationIds.size === 0 && !hasSchemaVersionTable) {
    const totalStatements = await applyMigrationBundle(pendingMigrations);
    lastAppliedMigrations = pendingMigrations.map((m) => m.id);
    console.log(
      `[local-db] Fresh install migration bundle completed (${totalStatements} statements)`
    );
  } else {
    for (const migration of pendingMigrations) {
      console.log(`[local-db] Applying migration ${migration.id}`);
      await applyMigration(migration);
    }
    lastAppliedMigrations = pendingMigrations.map((m) => m.id);
  }

  console.log("[local-db] Migrations completed successfully");
  await emitSchemaMigratedEvent(lastAppliedMigrations);
}

/**
 * Initialize database and run migrations.
 * Call this once on app startup.
 */
export async function initializeDatabase(): Promise<void> {
  await runMigrations();
}
