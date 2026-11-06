import type { DomainEventEnvelope } from "./DomainEvent";

export interface ReviewCreated extends DomainEventEnvelope {
  type: "ReviewCreated.v1";
  entityType: "review";
  /**
   * `reviewId` on this event equals `entityId` — the review's own ID.
   * Included for consistency so consumers can always correlate by `reviewId`
   * regardless of which entity type they encounter.
   */
  data: {
    name: string;
    subjectId: string;
    subjectType: "product" | "team";
    templateIds: string[];
    /** Scope chosen in the review wizard. */
    scope: "team" | "application" | "product";
    /** Application IDs in scope. Empty array when scope is "team" or "product". */
    applicationIds: string[];
    /** Team IDs associated with this review at creation time. */
    teamIds: string[];
  };
}

export interface ReviewArchived extends DomainEventEnvelope {
  type: "ReviewArchived.v1";
  entityType: "review";
  data: {
    name: string;
  };
}

export interface ReviewRestored extends DomainEventEnvelope {
  type: "ReviewRestored.v1";
  entityType: "review";
  data: {
    name: string;
  };
}

export interface ReviewDeleted extends DomainEventEnvelope {
  type: "ReviewDeleted.v1";
  entityType: "review";
  data: {
    name: string;
  };
}

// ─── System events ────────────────────────────────────────────
//
// All system events use source=peaky.system, actorType=system, actorId=system.
// Events flagged `local: true` in the catalog (see schemas/index.ts) stay
// on the device by design — DB lifecycle and per-browser storage state are
// meaningless to other actors. Sync-ops events default to push-eligible so
// postmortems can correlate which session synced what.
//
// Convention: every catalog entry explicitly sets `local: true` (device-only)
// or `local: false` (push-eligible). The `local` field is required — no silent
// default. The contract is pinned by tests/unit/services/events/schemas.test.ts.

// ── DB lifecycle ──────────────────────────────────────────────

/**
 * Emitted at the start of `bootstrap.ensureLocalDatabaseReady()` when the
 * local SQLite client begins initialisation. Pairs with `LocalDbReady.v1`
 * on success or `LocalDbMigrationFailed.v1` on a migration failure.
 */
export interface LocalDbInitializing extends DomainEventEnvelope {
  type: "LocalDbInitializing.v1";
  entityType: "local_db";
  data: {
    /** True when OPFS is available; false on browsers that fall back to memory. */
    opfsAvailable: boolean;
  };
}

/**
 * Emitted when the local database is ready to accept reads and writes.
 * Carries the cold-start duration so /system can show "Ready · 230 ms ago".
 */
export interface LocalDbReady extends DomainEventEnvelope {
  type: "LocalDbReady.v1";
  entityType: "local_db";
  data: {
    /** Wall-clock duration from the start of bootstrap to ready, in ms. */
    coldStartMs: number;
    /** True when OPFS is available; false on memory-only fallback. */
    opfsAvailable: boolean;
  };
}

/**
 * Emitted by the client plugin at the start of the warmup callback chain,
 * before `bootstrap.ensureLocalDatabaseReady()` runs. Used to distinguish
 * between a normal load and one that follows a `LOCAL_STORAGE_CLEAR_FLAG`
 * recreate.
 */
export interface LocalDbBootstrapStarted extends DomainEventEnvelope {
  type: "LocalDbBootstrapStarted.v1";
  entityType: "local_db";
  data: {
    /** True when this bootstrap follows a user-triggered recreate-DB reload. */
    isRecreate: boolean;
  };
}

/**
 * Emitted on the first ready signal after a `LOCAL_STORAGE_CLEAR_FLAG`
 * reload so the recreate flow is observable end-to-end. The /system page
 * can show "Last recreated: 2 min ago" off the latest event of this type.
 */
export interface LocalDbRecreated extends DomainEventEnvelope {
  type: "LocalDbRecreated.v1";
  entityType: "local_db";
  data: {
    /** Origin of the recreate. Currently always "user" via the /system action. */
    triggeredBy: "user";
  };
}

/**
 * Emitted by the migration runner when `applyMigration()` or
 * `applyMigrationBundle()` throws. Pairs with the `_migration_log` row that
 * also records the failure — the event is the public-facing signal, the
 * log is the local-only diagnostic.
 *
 * Error messages are sanitised at the emission site: no stack traces,
 * file paths, or embedded values.
 */
export interface LocalDbMigrationFailed extends DomainEventEnvelope {
  type: "LocalDbMigrationFailed.v1";
  entityType: "schema";
  data: {
    /** Migration ID that failed (e.g., "0007_domain_events_rename_source_values"). */
    migrationId: string;
    /** Sanitised error message. Stack traces and paths stripped before emission. */
    errorMessage: string;
  };
}

/**
 * Emitted by the client migration runner after applying one or more pending
 * migrations on startup. Not emitted when no migrations were pending.
 */
export interface ClientSchemaMigrated extends DomainEventEnvelope {
  type: "ClientSchemaMigrated.v1";
  entityType: "schema";
  data: {
    /** IDs of the migrations applied in this run, in application order. */
    migrationsApplied: string[];
    /** Total number of standard migrations in the bundle after this run. */
    schemaVersion: number;
  };
}

// ── Storage ───────────────────────────────────────────────────

/**
 * Emitted when an OPFS quota measurement crosses a warning threshold
 * (currently 80% of available quota). The /system Storage tile uses the
 * latest event of this type to surface a quota warning banner.
 */
export interface OpfsQuotaWarning extends DomainEventEnvelope {
  type: "OpfsQuotaWarning.v1";
  entityType: "storage";
  data: {
    /** Bytes currently used by Peaky's OPFS storage. */
    usageBytes: number;
    /** Browser-reported quota for the origin. */
    quotaBytes: number;
    /** Rounded percentage of quota used (0..100). */
    usagePct: number;
  };
}

/**
 * Emitted whenever the /system page or sync cycle measures OPFS usage via
 * `navigator.storage.estimate()`. Carries `supported: false` on browsers
 * that lack the Storage Estimation API.
 */
export interface OpfsStorageMeasured extends DomainEventEnvelope {
  type: "OpfsStorageMeasured.v1";
  entityType: "storage";
  data: {
    /** Bytes used. Null when the Storage Estimation API is unavailable. */
    usageBytes: number | null;
    /** Browser-reported quota. Null when the Storage Estimation API is unavailable. */
    quotaBytes: number | null;
    /** Whether `navigator.storage.estimate()` returned a usable measurement. */
    supported: boolean;
  };
}

// ── Sync operations ───────────────────────────────────────────

/**
 * Emitted at the start of `SyncEngine.runSyncCycle()`. Pairs with either
 * `SyncCycleSucceeded.v1` or `SyncCycleFailed.v1`. The `cycleId` is a
 * local UUID used to correlate the start/end records.
 *
 * Sync-ops events are NOT flagged `local: true` so they sync to the server
 * once the Rust event push pipeline lands — postmortems require knowing
 * which client session synced what.
 */
export interface SyncCycleStarted extends DomainEventEnvelope {
  type: "SyncCycleStarted.v1";
  entityType: "sync_cycle";
  data: {
    /** UUID generated at cycle start. */
    cycleId: string;
  };
}

/**
 * Emitted when `SyncEngine.runSyncCycle()` completes successfully.
 * Carries the counts and timing the /system Sync tile uses for "0 pending,
 * last 14:32".
 */
export interface SyncCycleSucceeded extends DomainEventEnvelope {
  type: "SyncCycleSucceeded.v1";
  entityType: "sync_cycle";
  data: {
    /** Matches the cycleId on the corresponding SyncCycleStarted event. */
    cycleId: string;
    /** Outbox items pushed in this cycle. */
    eventsPushed: number;
    /** Events pulled from the server in this cycle. Always 0 today. */
    eventsPulled: number;
    /** Wall-clock duration of the cycle, in ms. */
    durationMs: number;
  };
}

/**
 * Emitted when `SyncEngine.runSyncCycle()` throws or returns a failed
 * result. The `errorMessage` is sanitised — stack traces and paths
 * stripped before emission.
 */
export interface SyncCycleFailed extends DomainEventEnvelope {
  type: "SyncCycleFailed.v1";
  entityType: "sync_cycle";
  data: {
    /** Matches the cycleId on the corresponding SyncCycleStarted event. */
    cycleId: string;
    /** Sanitised error message. */
    errorMessage: string;
    /** Wall-clock duration before failure, in ms. */
    durationMs: number;
  };
}

/**
 * Emitted on a successful `SyncEngine.refreshEntitlements()`. Used by the
 * admin feed to correlate sudden permission shifts with a refresh moment.
 */
export interface EntitlementsRefreshed extends DomainEventEnvelope {
  type: "EntitlementsRefreshed.v1";
  entityType: "entitlements";
  data: {
    /** True when the refresh removed at least one previously-granted entitlement. */
    hasDowngrades: boolean;
    /** Total number of entitlement changes applied (additions and removals). */
    changeCount: number;
  };
}

// ─── Union type ───────────────────────────────────────────────
