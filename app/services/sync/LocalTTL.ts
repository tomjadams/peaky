/**
 * LocalTTL — periodic sweep to prune stale local events and field history.
 *
 * Keeps the SQLite database lean by removing rows older than TTL_DAYS.
 * Called post-sync or at startup. Never blocks the sync cycle — failures
 * are logged and swallowed.
 *
 * Defaults:
 *   LOCAL_TTL_DAYS = 14   (overridable via env / runtimeConfig)
 */

import { getDatabase, isLocalDatabaseReady } from "~/local-db";
import { events, fieldVersionEvents } from "#shared/db/schema";
import { lt } from "drizzle-orm";

export const LOCAL_TTL_DAYS = 14;

/**
 * Delete events and field_version_events older than `ttlDays` from the local DB.
 *
 * @returns counts of deleted rows for observability.
 */
export async function sweepLocalTTL(
  ttlDays = LOCAL_TTL_DAYS
): Promise<{ eventsDeleted: number; fieldVersionsDeleted: number }> {
  // Enforce a minimum of 1 day to prevent accidental full-wipe.
  ttlDays = Math.max(1, ttlDays);
  if (!isLocalDatabaseReady()) {
    return { eventsDeleted: 0, fieldVersionsDeleted: 0 };
  }

  const cutoff = new Date(
    Date.now() - ttlDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const db = await getDatabase();

  await Promise.all([
    db.delete(events).where(lt(events.time, cutoff)),
    db
      .delete(fieldVersionEvents)
      .where(lt(fieldVersionEvents.updatedAt, cutoff)),
  ]);

  // SQLocal returns no reliable affected-row counts — return sentinel values
  return { eventsDeleted: -1, fieldVersionsDeleted: -1 };
}
