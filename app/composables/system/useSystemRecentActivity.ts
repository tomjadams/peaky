/**
 * Composable powering the SystemRecentActivity table on /system.
 *
 * Reads `peaky.system` events from the local SQLite events table and scopes
 * them to the current browser session via the latest LocalDbInitializing.v1
 * event time as a `gte` lower bound. Cross-session history lives on /events.
 *
 * No HTTP calls — everything is read from the local database.
 */

import { ref } from "vue";
import { withDatabase, events, eq, and, desc, gte } from "~/local-db";
import { formatAdminEventLabel } from "~/admin/events";

const PAGE_SIZE = 10;

export interface ActivityRow {
  id: string;
  time: string;
  eventType: string;
  actionLabel: string;
  detail: string;
}

type EventData = Record<string, unknown>;

function detailClientSchemaMigrated(data: EventData): string {
  const applied = Array.isArray(data.migrationsApplied)
    ? data.migrationsApplied
    : [];
  return applied.length > 0
    ? `${applied.length} migration${applied.length === 1 ? "" : "s"} applied`
    : "no migrations pending";
}

function detailOpfsStorageMeasured(data: EventData): string {
  if (data.supported !== true) return "storage API unavailable";
  const used = typeof data.usageBytes === "number" ? data.usageBytes : null;
  const quota = typeof data.quotaBytes === "number" ? data.quotaBytes : null;
  if (used !== null && quota !== null && quota > 0) {
    return `${Math.round((used / quota) * 100)}% used`;
  }
  return "measured";
}

const EVENT_DETAIL_HANDLERS: Record<string, (data: EventData) => string> = {
  "ClientSchemaMigrated.v1": detailClientSchemaMigrated,
  "LocalDbReady.v1": (data) => {
    const ms = typeof data.coldStartMs === "number" ? data.coldStartMs : null;
    return ms !== null ? `cold start · ${ms} ms` : "ready";
  },
  "LocalDbMigrationFailed.v1": (data) =>
    typeof data.migrationId === "string"
      ? `failed · ${data.migrationId}`
      : "migration failed",
  "SyncCycleSucceeded.v1": (data) => {
    const pushed =
      typeof data.eventsPushed === "number" ? data.eventsPushed : 0;
    const pulled =
      typeof data.eventsPulled === "number" ? data.eventsPulled : 0;
    return `${pushed} pushed · ${pulled} pulled`;
  },
  "SyncCycleFailed.v1": (data) =>
    typeof data.errorMessage === "string" ? data.errorMessage : "sync failed",
  "OpfsStorageMeasured.v1": detailOpfsStorageMeasured,
  "OpfsQuotaWarning.v1": (data) =>
    typeof data.usagePct === "number" ? `${data.usagePct}% used` : "near quota",
  "EntitlementsRefreshed.v1": (data) => {
    const count = typeof data.changeCount === "number" ? data.changeCount : 0;
    return count > 0
      ? `${count} change${count === 1 ? "" : "s"}`
      : "no changes";
  },
};

/**
 * Build the human-readable Detail column from a row's typed `data` JSON.
 * Pure: depends only on `eventType` and `data`. Exported so unit tests can
 * pin the per-event-type formatting without mounting the component.
 */
export function buildDetail(row: {
  eventType: string;
  data: string | null;
}): string {
  if (!row.data) return "";
  try {
    const data = JSON.parse(row.data) as EventData;
    return EVENT_DETAIL_HANDLERS[row.eventType]?.(data) ?? "";
  } catch {
    return "";
  }
}

/**
 * Resolve the session boundary by reading the latest
 * `LocalDbInitializing.v1` event time. Returns null when no Initializing
 * event exists yet (fresh install) — callers should treat null as "no
 * lower bound" since all rows on a fresh install are session-current
 * anyway.
 */
export async function resolveSessionStart(): Promise<string | null> {
  try {
    const initRows = await withDatabase(async (db) => {
      return db
        .select({ time: events.time })
        .from(events)
        .where(eq(events.eventType, "LocalDbInitializing.v1"))
        .orderBy(desc(events.time))
        .limit(1);
    });
    return initRows[0]?.time ?? null;
  } catch {
    return null;
  }
}

export function useSystemRecentActivity() {
  const rows = ref<ActivityRow[]>([]);
  const isLoading = ref(true);
  const isLoadingMore = ref(false);
  const error = ref<Error | null>(null);
  const currentLimit = ref(PAGE_SIZE);
  const hasMore = ref(false);
  const sessionStartTime = ref<string | null>(null);

  async function loadRows(limit = currentLimit.value) {
    isLoading.value = true;
    error.value = null;
    try {
      const dbRows = await withDatabase(async (db) => {
        const baseFilter = eq(events.source, "peaky.system");
        const whereClause = sessionStartTime.value
          ? and(baseFilter, gte(events.time, sessionStartTime.value))
          : baseFilter;
        return db
          .select()
          .from(events)
          .where(whereClause)
          .orderBy(desc(events.time))
          .limit(limit + 1);
      });

      hasMore.value = dbRows.length > limit;
      rows.value = dbRows.slice(0, limit).map((row) => ({
        id: row.id,
        time: row.time,
        eventType: row.eventType,
        actionLabel: formatAdminEventLabel(row.eventType),
        detail: buildDetail(row),
      }));
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMore() {
    isLoadingMore.value = true;
    currentLimit.value += PAGE_SIZE;
    await loadRows(currentLimit.value);
    isLoadingMore.value = false;
  }

  async function refresh() {
    currentLimit.value = PAGE_SIZE;
    await loadRows(PAGE_SIZE);
  }

  async function init() {
    // Resolve the session boundary BEFORE the first query so the table is
    // scoped to the current browser session. Cross-session history is one
    // click away via the "See full history in Events" link.
    sessionStartTime.value = await resolveSessionStart();
    await loadRows();
  }

  return {
    rows,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    sessionStartTime,
    init,
    refresh,
    loadMore,
  };
}
