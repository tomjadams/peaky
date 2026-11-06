/**
 * Database connection module.
 *
 * Provides an in-memory SQLite database via better-sqlite3 for the sync simulator.
 * The server and client now apply the same shared SQL migration files.
 */
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import {
  getSQLiteMigrations,
  getSQLiteMigrationSql,
  SQLITE_MIGRATIONS_TABLE,
  splitMigrationStatements,
  type SQLiteMigration,
} from "../../shared/db/migrations";

let db: ReturnType<typeof drizzleBetterSqlite> | null = null;
let sqlite: Database.Database | null = null;

function ensureMigrationsTable(sqliteConn: Database.Database): void {
  sqliteConn.exec(`
    CREATE TABLE IF NOT EXISTS ${SQLITE_MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getAppliedMigrationIds(sqliteConn: Database.Database): Set<string> {
  const rows = sqliteConn
    .prepare(`SELECT id FROM ${SQLITE_MIGRATIONS_TABLE} ORDER BY id`)
    .all() as Array<{ id: string }>;

  return new Set(rows.map((row) => row.id));
}

function applyMigration(
  sqliteConn: Database.Database,
  migration: SQLiteMigration
): void {
  const statements = splitMigrationStatements(getSQLiteMigrationSql(migration));

  const apply = sqliteConn.transaction(() => {
    for (const statement of statements) {
      sqliteConn.exec(statement);
    }

    sqliteConn
      .prepare(`INSERT INTO ${SQLITE_MIGRATIONS_TABLE} (id) VALUES (?)`)
      .run(migration.id);
  });

  apply();
}

/**
 * Get or create the in-memory database connection.
 *
 * For the sync simulator, we use an in-memory SQLite that:
 * - Is fast for testing
 * - Loses state on server restart (acceptable for simulator)
 * - Uses the same Drizzle schemas and migration files as the client runtime
 */
export function getDatabase() {
  if (db) return db;

  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  db = drizzleBetterSqlite(sqlite, { schema });

  runMigrations(sqlite);

  return db;
}

/**
 * Run shared SQLite migrations.
 */
function runMigrations(sqliteConn: Database.Database) {
  ensureMigrationsTable(sqliteConn);

  const appliedMigrationIds = getAppliedMigrationIds(sqliteConn);
  const pendingMigrations = getSQLiteMigrations().filter(
    (migration) => !appliedMigrationIds.has(migration.id)
  );

  for (const migration of pendingMigrations) {
    applyMigration(sqliteConn, migration);
  }
}

/**
 * Reset the database (for testing).
 */
export function resetDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

/**
 * Get the raw SQLite connection (for testing).
 */
export function getSqlite(): Database.Database | null {
  return sqlite;
}
