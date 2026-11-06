/**
 * Storage health monitoring and outbox pruning.
 *
 * Uses navigator.storage.estimate() for quota tracking (browser only).
 * Uses withDatabase() for DB-level stats and pruning.
 *
 * No Vue imports — all operations are pure async.
 */

import { withDatabase, sql, eq } from "~/local-db";
import { localOutbox, events } from "#shared/db/schema";
import { DB_NAME } from "~/local-db/client";

const WARN_QUOTA_THRESHOLD = 0.8; // warn at 80% quota used
const WARN_SYNCED_OUTBOX_COUNT = 1000;
const WARN_SYNCED_DOMAIN_EVENTS_COUNT = 5000;

export class StorageMonitor {
  /**
   * Return the actual SQLite database file size in bytes.
   *
   * Reads the OPFS file directly rather than using `navigator.storage.estimate()`
   * which inflates usage by including service worker caches and other origin
   * storage. Falls back to the broad estimate when OPFS file access is unavailable.
   *
   * Returns null on SSR or when storage APIs are unavailable.
   */
  async getDatabaseSizeBytes(): Promise<number | null> {
    if (!import.meta.client) return null;
    if (typeof navigator === "undefined") return null;

    // Try to read the actual OPFS file size first.
    if (typeof navigator.storage?.getDirectory === "function") {
      try {
        const root = await navigator.storage.getDirectory();
        const filenames = [
          `${DB_NAME}.sqlite3`,
          `${DB_NAME}.sqlite3-wal`,
          `${DB_NAME}.sqlite3-shm`,
        ];
        let totalBytes = 0;
        let found = false;
        await Promise.all(
          filenames.map(async (name) => {
            try {
              const handle = await root.getFileHandle(name);
              const file = await handle.getFile();
              totalBytes += file.size;
              found = true;
            } catch {
              // File absent — skip.
            }
          })
        );
        if (found) return totalBytes;
      } catch {
        // Fall through to estimate-based fallback.
      }
    }

    if (!navigator.storage?.estimate) return null;
    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Return row counts for key tables relevant to storage health.
   */
  async getTableStats(): Promise<Record<string, number>> {
    return withDatabase(async (db) => {
      const [outboxResult, eventsResult] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(localOutbox)
          .where(eq(localOutbox.status, "synced")),
        db
          .select({ count: sql<number>`count(*)` })
          .from(events)
          .where(eq(events.status, "synced")),
      ]);

      return {
        syncedOutboxItems: Number(outboxResult[0]?.count ?? 0),
        syncedDomainEvents: Number(eventsResult[0]?.count ?? 0),
      };
    });
  }

  /**
   * Return an overall health assessment with warnings.
   */
  async getStorageHealth(): Promise<{
    healthy: boolean;
    usedBytes: number | null;
    quotaBytes: number | null;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    let usedBytes: number | null = null;
    let quotaBytes: number | null = null;

    if (import.meta.client && navigator.storage?.estimate) {
      try {
        const [estimate, dbSize] = await Promise.all([
          navigator.storage.estimate(),
          this.getDatabaseSizeBytes(),
        ]);
        usedBytes = dbSize;
        quotaBytes = estimate.quota ?? null;

        if (
          usedBytes !== null &&
          quotaBytes !== null &&
          quotaBytes > 0 &&
          usedBytes / quotaBytes > WARN_QUOTA_THRESHOLD
        ) {
          const pct = Math.round((usedBytes / quotaBytes) * 100);
          warnings.push(
            `Storage quota ${pct}% used — consider pruning old data`
          );
        }
      } catch {
        // Storage estimate unavailable — not a health warning
      }
    }

    let tableStats: Record<string, number> = {};
    try {
      tableStats = await this.getTableStats();
    } catch {
      warnings.push("Unable to read table statistics");
    }

    const syncedOutbox = tableStats["syncedOutboxItems"] ?? 0;
    const syncedEvents = tableStats["syncedDomainEvents"] ?? 0;

    if (syncedOutbox > WARN_SYNCED_OUTBOX_COUNT) {
      warnings.push(
        `${syncedOutbox} synced outbox items — run pruneOutbox() to reclaim space`
      );
    }

    if (syncedEvents > WARN_SYNCED_DOMAIN_EVENTS_COUNT) {
      warnings.push(
        `${syncedEvents} synced domain events — consider archiving old events`
      );
    }

    return {
      healthy: warnings.length === 0,
      usedBytes,
      quotaBytes,
      warnings,
    };
  }

  /**
   * Delete synced outbox entries older than N days.
   * Returns the count of deleted rows.
   */
  async pruneOutbox(olderThanDays = 30): Promise<number> {
    return withDatabase(async (db) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      const cutoffStr = cutoff.toISOString();

      const candidates = await db
        .select({ id: localOutbox.id })
        .from(localOutbox)
        .where(
          sql`${localOutbox.status} = 'synced' AND ${localOutbox.updatedAt} < ${cutoffStr}`
        );

      for (const row of candidates) {
        await db.delete(localOutbox).where(sql`${localOutbox.id} = ${row.id}`);
      }

      return candidates.length;
    });
  }
}

export const storageMonitor = new StorageMonitor();
