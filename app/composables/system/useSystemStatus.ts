/**
 * Composable powering the /system page tiles.
 *
 * Reads the latest `peaky.system` events from the events table and the
 * local outbox depth, derives the four glance signals (Database, Schema,
 * Storage, Sync) the /system page renders.
 *
 * No HTTP calls — every signal comes from the local SQLite or the
 * `useState('local-db-error')` reactive bootstrap-error surface owned by
 * the local-db plugin.
 */

import { computed, ref } from "vue";
import { withDatabase, events, localOutbox, desc, eq, and } from "~/local-db";
import { measureOpfs } from "~/services/events/opfsMeasurement";
import { SCHEMA_VERSION } from "~/local-db/migrations";

// ─── Tile state shapes ─────────────────────────────────────────

export type DatabaseHealth = "healthy" | "error" | "initializing";
export type SchemaState = "up-to-date" | "stuck";
export type StorageState = "ok" | "warning" | "unsupported";
export type SyncState =
  | "in-sync"
  | "not-yet-synced"
  | "stale"
  | "paused"
  | "failed";

export interface DatabaseTile {
  health: DatabaseHealth;
  /** ISO time of latest LocalDbReady event; null when none yet. */
  readyAt: string | null;
  /** Cold-start duration from the latest Ready event, in ms. */
  coldStartMs: number | null;
  /** Sanitised error message when health === "error". */
  errorMessage: string | null;
  /** Failed migration ID when applicable. */
  failedMigrationId: string | null;
}

export interface SchemaTile {
  state: SchemaState;
  /** Latest applied schema version (matches SCHEMA_VERSION on success). */
  version: number;
  /** Total expected schema version (from the migration list). */
  expectedVersion: number;
  /** Migration IDs applied in the latest ClientSchemaMigrated event. */
  migrationsApplied: string[];
}

export interface StorageTile {
  state: StorageState;
  usageBytes: number | null;
  quotaBytes: number | null;
  usagePct: number | null;
}

export interface SyncTile {
  state: SyncState;
  /** ISO time of the latest sync-cycle terminal event. */
  lastSyncAt: string | null;
  /** Outbox rows still pending push. */
  pendingCount: number;
  /** Sanitised error message when state === "failed". */
  errorMessage: string | null;
}

// ─── Implementation helpers ────────────────────────────────────

/**
 * Parses an event's `data` JSON. The generic is unvalidated — there is no
 * runtime check that the parsed shape matches `T`. Every call site MUST use
 * optional chaining + a fallback (`data?.field ?? fallback`) so a malformed
 * or partial payload doesn't propagate as an undefined field.
 */
function parseEventData<T>(data: string | null): T | null {
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

async function findLatestSystemEvent(eventType: string) {
  return withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(events)
      .where(
        and(eq(events.eventType, eventType), eq(events.source, "peaky.system"))
      )
      .orderBy(desc(events.time))
      .limit(1);
    return rows[0] ?? null;
  });
}

async function getOutboxPendingCount(): Promise<number> {
  return withDatabase(async (db) => {
    const rows = await db
      .select({ id: localOutbox.id })
      .from(localOutbox)
      .where(eq(localOutbox.status, "pending"));
    return rows.length;
  });
}

// ─── Composable ────────────────────────────────────────────────

const STALE_SYNC_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export function useSystemStatus() {
  const dbError = useState<{
    message: string;
    at: string;
    migrationId?: string;
  } | null>("local-db-error", () => null);

  const database = ref<DatabaseTile>({
    health: "initializing",
    readyAt: null,
    coldStartMs: null,
    errorMessage: null,
    failedMigrationId: null,
  });

  const schema = ref<SchemaTile>({
    state: "up-to-date",
    version: SCHEMA_VERSION,
    expectedVersion: SCHEMA_VERSION,
    migrationsApplied: [],
  });

  const storage = ref<StorageTile>({
    state: "ok",
    usageBytes: null,
    quotaBytes: null,
    usagePct: null,
  });

  const sync = ref<SyncTile>({
    state: "in-sync",
    lastSyncAt: null,
    pendingCount: 0,
    errorMessage: null,
  });

  const lastRefreshedAt = ref<string | null>(null);
  const isRefreshing = ref(false);

  async function refreshDatabase() {
    if (dbError.value) {
      database.value = {
        health: "error",
        readyAt: null,
        coldStartMs: null,
        errorMessage: dbError.value.message,
        failedMigrationId: dbError.value.migrationId ?? null,
      };
      return;
    }

    const readyRow = await findLatestSystemEvent("LocalDbReady.v1");
    const failedRow = await findLatestSystemEvent("LocalDbMigrationFailed.v1");

    if (
      failedRow &&
      (!readyRow ||
        new Date(failedRow.time).getTime() > new Date(readyRow.time).getTime())
    ) {
      const data = parseEventData<{
        migrationId: string;
        errorMessage: string;
      }>(failedRow.data);
      database.value = {
        health: "error",
        readyAt: null,
        coldStartMs: null,
        errorMessage: data?.errorMessage ?? "Migration failed",
        failedMigrationId: data?.migrationId ?? null,
      };
      return;
    }

    if (readyRow) {
      const data = parseEventData<{ coldStartMs: number }>(readyRow.data);
      database.value = {
        health: "healthy",
        readyAt: readyRow.time,
        coldStartMs: data?.coldStartMs ?? null,
        errorMessage: null,
        failedMigrationId: null,
      };
      return;
    }

    database.value = {
      health: "initializing",
      readyAt: null,
      coldStartMs: null,
      errorMessage: null,
      failedMigrationId: null,
    };
  }

  async function refreshSchema() {
    const row = await findLatestSystemEvent("ClientSchemaMigrated.v1");
    const data = parseEventData<{
      migrationsApplied: string[];
      schemaVersion: number;
    }>(row?.data ?? null);

    schema.value = {
      // The `events.length` of the migration array tells us we're up to date
      // when the runner emits the event with the canonical SCHEMA_VERSION.
      // No event yet just means migrations were already applied on a prior
      // load — schema is at SCHEMA_VERSION by definition.
      state:
        data && data.schemaVersion < SCHEMA_VERSION ? "stuck" : "up-to-date",
      version: data?.schemaVersion ?? SCHEMA_VERSION,
      expectedVersion: SCHEMA_VERSION,
      migrationsApplied: data?.migrationsApplied ?? [],
    };
  }

  async function refreshStorage() {
    const measurement = await measureOpfs();

    if (!measurement.supported) {
      storage.value = {
        state: "unsupported",
        usageBytes: null,
        quotaBytes: null,
        usagePct: null,
      };
      return;
    }

    const usagePct =
      measurement.usageBytes !== null &&
      measurement.quotaBytes !== null &&
      measurement.quotaBytes > 0
        ? Math.round((measurement.usageBytes / measurement.quotaBytes) * 100)
        : null;

    storage.value = {
      state: usagePct !== null && usagePct > 80 ? "warning" : "ok",
      usageBytes: measurement.usageBytes,
      quotaBytes: measurement.quotaBytes,
      usagePct,
    };
  }

  async function refreshSync() {
    if (database.value.health === "error") {
      sync.value = {
        state: "paused",
        lastSyncAt: null,
        pendingCount: 0,
        errorMessage: null,
      };
      return;
    }

    const succeededRow = await findLatestSystemEvent("SyncCycleSucceeded.v1");
    const failedRow = await findLatestSystemEvent("SyncCycleFailed.v1");
    const pendingCount = await getOutboxPendingCount();

    const latest =
      succeededRow && failedRow
        ? new Date(succeededRow.time).getTime() >
          new Date(failedRow.time).getTime()
          ? succeededRow
          : failedRow
        : (succeededRow ?? failedRow);

    if (!latest) {
      // No sync cycle has ever completed. "in-sync" only when there's also
      // nothing to push — otherwise the server demonstrably does not have
      // everything this browser has, which is the opposite of in-sync.
      sync.value = {
        state: pendingCount > 0 ? "not-yet-synced" : "in-sync",
        lastSyncAt: null,
        pendingCount,
        errorMessage: null,
      };
      return;
    }

    if (latest === failedRow) {
      const data = parseEventData<{ errorMessage: string }>(latest.data);
      sync.value = {
        state: "failed",
        lastSyncAt: latest.time,
        pendingCount,
        errorMessage: data?.errorMessage ?? "Sync failed",
      };
      return;
    }

    const ageMs = Date.now() - new Date(latest.time).getTime();
    sync.value = {
      state: ageMs > STALE_SYNC_THRESHOLD_MS ? "stale" : "in-sync",
      lastSyncAt: latest.time,
      pendingCount,
      errorMessage: null,
    };
  }

  async function refresh() {
    if (isRefreshing.value) return;
    isRefreshing.value = true;
    try {
      await refreshDatabase();
      await refreshSchema();
      await refreshStorage();
      await refreshSync();
      lastRefreshedAt.value = new Date().toISOString();
    } finally {
      isRefreshing.value = false;
    }
  }

  const hasError = computed(
    () => database.value.health === "error" || dbError.value !== null
  );

  return {
    database,
    schema,
    storage,
    sync,
    hasError,
    isRefreshing,
    lastRefreshedAt,
    refresh,
  };
}
