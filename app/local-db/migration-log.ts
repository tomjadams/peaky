/**
 * Lightweight migration audit log — written OUTSIDE the migration chain.
 *
 * This table is created with CREATE TABLE IF NOT EXISTS before any Drizzle
 * migrations run, so it can record migration failures even when the main
 * schema is in a broken state.  It uses raw SQLocal SQL exclusively — never
 * Drizzle — to avoid any dependency on the schema being correct.
 *
 * Unlike events, this table is not synced to the server.  It is a
 * local-only diagnostic aid.  The admin can inspect it via peakyDB.migrationLog().
 */

import { getSQLocal } from "./client";

const TABLE = "_migration_log";

export interface MigrationLogEntry {
  id: string;
  migration_id: string;
  status: "applied" | "failed";
  duration_ms: number | null;
  error: string | null;
  applied_at: string;
}

export class MigrationLog {
  async ensure(): Promise<void> {
    const sq = await getSQLocal();
    await sq.sql(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        id TEXT PRIMARY KEY,
        migration_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('applied', 'failed')),
        duration_ms INTEGER,
        error TEXT,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );
  }

  async recordApplied(migrationId: string, durationMs: number): Promise<void> {
    const sq = await getSQLocal();
    await sq.sql(
      `INSERT INTO ${TABLE} (id, migration_id, status, duration_ms) VALUES (?, ?, 'applied', ?)`,
      crypto.randomUUID(),
      migrationId,
      durationMs
    );
  }

  async recordFailed(migrationId: string, error: Error): Promise<void> {
    try {
      const sq = await getSQLocal();
      await sq.sql(
        `INSERT INTO ${TABLE} (id, migration_id, status, error) VALUES (?, ?, 'failed', ?)`,
        crypto.randomUUID(),
        migrationId,
        error.message
      );
    } catch {
      // Writing to the migration log itself failed — this is a last-resort table.
      // There is nothing further we can do; the error is already recorded in the
      // caller's thrown exception and in localStorage via the plugin.
    }
  }

  async read(): Promise<MigrationLogEntry[]> {
    const sq = await getSQLocal();
    return sq.sql<MigrationLogEntry>(
      `SELECT * FROM ${TABLE} ORDER BY applied_at DESC`
    );
  }
}

export const migrationLog = new MigrationLog();
