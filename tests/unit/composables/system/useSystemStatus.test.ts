/**
 * Unit tests for useSystemStatus — the composable that powers the /system
 * page tiles. Pinning the state-derivation contract for each tile.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { withDatabase } from "~/local-db";

import { useSystemStatus } from "~/composables/system/useSystemStatus";

// Each test seeds rows keyed by `${eventType}::${source}` so the smart mock
// can enforce the source predicate the composable applies — a regression
// dropping `eq(events.source, "peaky.system")` would silently start
// matching peaky.client events of the same type. Default helpers below
// seed under `peaky.system`.
const seededRows = new Map<string, Record<string, unknown> | null>();
function seedSystemEvent(
  eventType: string,
  row: Record<string, unknown> | null
) {
  seededRows.set(`${eventType}::peaky.system`, row);
}
function seedClientEvent(
  eventType: string,
  row: Record<string, unknown> | null
) {
  seededRows.set(`${eventType}::peaky.client`, row);
}

const outboxPendingCount = { value: 0 };

vi.mock("~/local-db", () => ({
  events: { eventType: "eventType", source: "source", time: "time" },
  localOutbox: { id: "id", status: "status" },
  desc: vi.fn((column: unknown) => column),
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  withDatabase: vi.fn(),
}));

vi.mock("~/local-db/migrations", () => ({
  SCHEMA_VERSION: 10,
}));

const measureMock = vi.fn();
vi.mock("~/services/events/opfsMeasurement", () => ({
  measureOpfs: () => measureMock(),
}));

// `useState` is auto-imported by Nuxt (vitest.config.ts sets `environment:
// "nuxt"`), so its memoization-by-key is real and shared across tests.
// We reset the bootstrap-error key in beforeEach so dbError-precedence
// tests don't leak into subsequent ones.

const smartWithDatabase = vi.mocked(withDatabase);
smartWithDatabase.mockImplementation(async (cb: unknown) => {
  const fakeDb = {
    select: (_projection?: unknown) => ({
      from: (table: { eventType?: unknown; id?: unknown }) => {
        if (table.id !== undefined && table.eventType === undefined) {
          // localOutbox path
          return {
            where: () =>
              Promise.resolve(
                Array.from({ length: outboxPendingCount.value }, (_, i) => ({
                  id: `outbox-${i}`,
                }))
              ),
          };
        }
        // events path — branch on the where clause produced by the
        // composable. Expect `and(eq(events.eventType, T), eq(events.source,
        // S))` so we read both predicates and look up the seeded row by
        // the (eventType, source) tuple. This way the test's mock encodes
        // the same contract the composable depends on.
        return {
          where: (condition: unknown) => ({
            orderBy: () => ({
              limit: () => {
                const conditions = condition as Array<{
                  column: unknown;
                  value: unknown;
                }>;
                const eventType =
                  conditions.find((c) => c.column === "eventType")?.value ?? "";
                const source =
                  conditions.find((c) => c.column === "source")?.value ?? "";
                const row = seededRows.get(`${eventType}::${source}`);
                return Promise.resolve(row ? [row] : []);
              },
            }),
          }),
        };
      },
    }),
  };
  return (cb as (db: unknown) => Promise<unknown>)(fakeDb);
});

beforeEach(() => {
  seededRows.clear();
  outboxPendingCount.value = 0;
  // Reset the shared Nuxt useState bootstrap-error ref so a previous
  // dbError-precedence test doesn't bleed into this one.
  useState<unknown>("local-db-error", () => null).value = null;
  measureMock.mockReset();
  measureMock.mockResolvedValue({
    usageBytes: 4_200_000,
    quotaBytes: 100_000_000,
    supported: true,
  });
});

describe("useSystemStatus — database tile", () => {
  it("starts in 'initializing' when no events seeded", async () => {
    const status = useSystemStatus();
    await status.refresh();
    expect(status.database.value.health).toBe("initializing");
  });

  it("derives 'healthy' from the latest LocalDbReady event", async () => {
    seedSystemEvent("LocalDbReady.v1", {
      time: "2026-04-30T14:32:00.000Z",
      data: JSON.stringify({ coldStartMs: 230, opfsAvailable: true }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.database.value).toMatchObject({
      health: "healthy",
      readyAt: "2026-04-30T14:32:00.000Z",
      coldStartMs: 230,
    });
  });

  it("derives 'error' when LocalDbMigrationFailed is newer than Ready", async () => {
    seedSystemEvent("LocalDbReady.v1", {
      time: "2026-04-30T14:00:00.000Z",
      data: JSON.stringify({ coldStartMs: 230, opfsAvailable: true }),
    });
    seedSystemEvent("LocalDbMigrationFailed.v1", {
      time: "2026-04-30T14:30:00.000Z",
      data: JSON.stringify({
        migrationId: "0010_events_cloudevents_columns_and_local_status",
        errorMessage: "constraint violation",
      }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.database.value).toMatchObject({
      health: "error",
      errorMessage: "constraint violation",
      failedMigrationId: "0010_events_cloudevents_columns_and_local_status",
    });
  });
});

describe("useSystemStatus — schema tile", () => {
  it("reports 'up-to-date' when no migration event exists", async () => {
    const status = useSystemStatus();
    await status.refresh();
    expect(status.schema.value).toMatchObject({
      state: "up-to-date",
      version: 10,
      expectedVersion: 10,
    });
  });

  it("reports 'stuck' when ClientSchemaMigrated reports a behind version", async () => {
    seedSystemEvent("ClientSchemaMigrated.v1", {
      time: "2026-04-30T13:00:00.000Z",
      data: JSON.stringify({
        migrationsApplied: ["0001_initial"],
        schemaVersion: 6,
      }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.schema.value.state).toBe("stuck");
    expect(status.schema.value.version).toBe(6);
    expect(status.schema.value.expectedVersion).toBe(10);
  });
});

describe("useSystemStatus — storage tile", () => {
  it("reports 'unsupported' when navigator.storage.estimate is unavailable", async () => {
    measureMock.mockResolvedValueOnce({
      usageBytes: null,
      quotaBytes: null,
      supported: false,
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.storage.value).toMatchObject({
      state: "unsupported",
      usageBytes: null,
      quotaBytes: null,
    });
  });

  it("reports 'warning' above 80% usage", async () => {
    measureMock.mockResolvedValueOnce({
      usageBytes: 85_000_000,
      quotaBytes: 100_000_000,
      supported: true,
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.storage.value.state).toBe("warning");
    expect(status.storage.value.usagePct).toBe(85);
  });

  it("reports 'ok' under 80% usage", async () => {
    measureMock.mockResolvedValueOnce({
      usageBytes: 4_200_000,
      quotaBytes: 100_000_000,
      supported: true,
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.storage.value.state).toBe("ok");
    expect(status.storage.value.usagePct).toBe(4);
  });
});

describe("useSystemStatus — sync tile", () => {
  it("reports 'in-sync' from a recent SyncCycleSucceeded", async () => {
    seedSystemEvent("SyncCycleSucceeded.v1", {
      time: new Date(Date.now() - 30_000).toISOString(),
      data: JSON.stringify({
        cycleId: "uuid-1",
        eventsPushed: 0,
        eventsPulled: 0,
        durationMs: 412,
      }),
    });
    outboxPendingCount.value = 0;
    const status = useSystemStatus();
    await status.refresh();
    expect(status.sync.value.state).toBe("in-sync");
    expect(status.sync.value.pendingCount).toBe(0);
  });

  it("reports 'stale' when last successful sync is over the threshold", async () => {
    seedSystemEvent("SyncCycleSucceeded.v1", {
      time: new Date(Date.now() - 5 * 60_000).toISOString(),
      data: JSON.stringify({
        cycleId: "uuid-1",
        eventsPushed: 0,
        eventsPulled: 0,
        durationMs: 412,
      }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.sync.value.state).toBe("stale");
  });

  it("reports 'failed' when SyncCycleFailed is newer than Succeeded", async () => {
    seedSystemEvent("SyncCycleSucceeded.v1", {
      time: "2026-04-30T13:00:00.000Z",
      data: JSON.stringify({
        cycleId: "uuid-1",
        eventsPushed: 0,
        eventsPulled: 0,
        durationMs: 412,
      }),
    });
    seedSystemEvent("SyncCycleFailed.v1", {
      time: "2026-04-30T13:30:00.000Z",
      data: JSON.stringify({
        cycleId: "uuid-2",
        errorMessage: "network unreachable",
        durationMs: 100,
      }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.sync.value.state).toBe("failed");
    expect(status.sync.value.errorMessage).toBe("network unreachable");
  });

  it("reports 'not-yet-synced' when no sync events exist but outbox is non-empty", async () => {
    // No SyncCycleSucceeded / SyncCycleFailed seeded.
    outboxPendingCount.value = 5;
    const status = useSystemStatus();
    await status.refresh();
    expect(status.sync.value.state).toBe("not-yet-synced");
    expect(status.sync.value.lastSyncAt).toBeNull();
    expect(status.sync.value.pendingCount).toBe(5);
  });

  it("reports 'in-sync' when no sync events exist and outbox is empty", async () => {
    // Vacuously in-sync: nothing has happened, nothing is pending.
    outboxPendingCount.value = 0;
    const status = useSystemStatus();
    await status.refresh();
    expect(status.sync.value.state).toBe("in-sync");
    expect(status.sync.value.lastSyncAt).toBeNull();
  });

  it("reports 'paused' when database is in error state", async () => {
    seedSystemEvent("LocalDbMigrationFailed.v1", {
      time: "2026-04-30T14:30:00.000Z",
      data: JSON.stringify({
        migrationId: "0010",
        errorMessage: "constraint violation",
      }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.sync.value.state).toBe("paused");
  });
});

describe("useSystemStatus — refresh", () => {
  it("hasError true when database is in error state", async () => {
    seedSystemEvent("LocalDbMigrationFailed.v1", {
      time: "2026-04-30T14:30:00.000Z",
      data: JSON.stringify({
        migrationId: "0010",
        errorMessage: "constraint violation",
      }),
    });
    const status = useSystemStatus();
    await status.refresh();
    expect(status.hasError.value).toBe(true);
  });

  it("isRefreshing flips while refresh is in flight", async () => {
    const status = useSystemStatus();
    expect(status.isRefreshing.value).toBe(false);
    const promise = status.refresh();
    expect(status.isRefreshing.value).toBe(true);
    await promise;
    expect(status.isRefreshing.value).toBe(false);
  });

  it("re-entry guard prevents concurrent refreshes", async () => {
    const status = useSystemStatus();
    // Fire two refreshes back-to-back without awaiting the first. The
    // guard at useSystemStatus.ts (`if (isRefreshing.value) return`)
    // should make the second call a no-op, so OPFS measurement runs once.
    const p1 = status.refresh();
    const p2 = status.refresh();
    await Promise.all([p1, p2]);
    expect(measureMock).toHaveBeenCalledTimes(1);
  });
});

describe("useSystemStatus — source predicate", () => {
  it("ignores peaky.client events with the same eventType as a system event", async () => {
    // A peaky.client event happening to share the SyncCycleSucceeded.v1
    // type must NOT be treated as a system-side sync. Without the
    // `eq(events.source, "peaky.system")` filter at the composable, this
    // would silently bleed into the sync tile.
    seedClientEvent("SyncCycleSucceeded.v1", {
      time: new Date(Date.now() - 30_000).toISOString(),
      data: JSON.stringify({
        cycleId: "client-uuid",
        eventsPushed: 0,
        eventsPulled: 0,
        durationMs: 1,
      }),
    });
    outboxPendingCount.value = 0;
    const status = useSystemStatus();
    await status.refresh();
    // No peaky.system SyncCycleSucceeded → composable falls through to
    // the "no sync events" branch, returns vacuously in-sync.
    expect(status.sync.value.lastSyncAt).toBeNull();
    expect(status.sync.value.state).toBe("in-sync");
  });
});

describe("useSystemStatus — dbError precedence", () => {
  it("flips database.health to 'error' when local-db-error useState is set", async () => {
    // Pre-seed the bootstrap-error reactive surface BEFORE the composable
    // reads it. Because useState is now memoized in the test shim, this
    // value persists across the composable's call to useState().
    // Use the auto-imported Nuxt `useState` (the real one, since
    // `environment: "nuxt"` is set in vitest config) so the ref the test
    // sets is the same one the composable reads.
    const errorRef = useState<{
      message: string;
      at: string;
      migrationId?: string;
    } | null>("local-db-error", () => null);
    errorRef.value = {
      message: "OPFS unavailable",
      at: "2026-04-30T10:00:00.000Z",
    };

    const status = useSystemStatus();
    await status.refresh();
    expect(status.database.value.health).toBe("error");
    expect(status.database.value.errorMessage).toBe("OPFS unavailable");
    expect(status.hasError.value).toBe(true);
  });

  it("dbError beats a healthy LocalDbReady event", async () => {
    // Seed a healthy Ready event AND a dbError. The dbError must win
    // because it represents a bootstrap-time failure the events table
    // didn't get to record.
    seedSystemEvent("LocalDbReady.v1", {
      time: "2026-04-30T14:32:00.000Z",
      data: JSON.stringify({ coldStartMs: 230, opfsAvailable: true }),
    });
    // Use the auto-imported Nuxt `useState` (the real one, since
    // `environment: "nuxt"` is set in vitest config) so the ref the test
    // sets is the same one the composable reads.
    const errorRef = useState<{
      message: string;
      at: string;
      migrationId?: string;
    } | null>("local-db-error", () => null);
    errorRef.value = {
      message: "post-bootstrap failure",
      at: "2026-04-30T10:00:00.000Z",
    };

    const status = useSystemStatus();
    await status.refresh();
    expect(status.database.value.health).toBe("error");
  });
});
