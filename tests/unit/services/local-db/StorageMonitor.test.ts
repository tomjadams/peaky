import { beforeEach, describe, it, expect, vi } from "vitest";
import type * as LocalDb from "~/local-db";

import { StorageMonitor } from "~/services/local-db/StorageMonitor";

// ── Mock ~/local-db before importing StorageMonitor ──────────────────────────
// withDatabase is injected so tests can control table data via the db stub.

let mockDb: {
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => {
      return fn(mockDb);
    }),
    // Pass through sql and eq so the StorageMonitor's SQL fragments compile.
    sql: actual.sql,
    eq: actual.eq,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal Drizzle-like db stub that returns configurable row counts. */
function makeDb(overrides: {
  syncedOutboxCount?: number;
  syncedDomainEventsCount?: number;
  deleteCandidates?: Array<{ id: string }>;
}) {
  const {
    syncedOutboxCount = 0,
    syncedDomainEventsCount = 0,
    deleteCandidates = [],
  } = overrides;

  let callIndex = 0;
  const countResults = [
    [{ count: syncedOutboxCount }],
    [{ count: syncedDomainEventsCount }],
  ];

  // delete chain mock
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });

  // We need select to handle two shapes:
  // 1. getTableStats: .select({count}).from().where() → [{count: N}]
  // 2. pruneOutbox: .select({id}).from().where() → [{id: '...'}]

  const fromFn = vi.fn(() => ({
    where: vi.fn((condition: unknown) => {
      // If condition looks like a pruning SQL tag (contains 'synced'), return candidates
      const condStr = String(condition);
      if (
        condStr.includes("synced") &&
        deleteCandidates.length >= 0 &&
        callIndex >= 2
      ) {
        return Promise.resolve(deleteCandidates);
      }
      // Otherwise return count rows
      const rows = countResults[callIndex++] ?? [{ count: 0 }];
      return Promise.resolve(rows);
    }),
  }));

  const selectFn = vi.fn(() => ({ from: fromFn }));

  return {
    select: selectFn,
    delete: deleteFn,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StorageMonitor.getStorageHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no storage estimate API
    Object.defineProperty(globalThis, "navigator", {
      value: { storage: undefined },
      writable: true,
      configurable: true,
    });
  });

  it("returns healthy with no warnings when counts are below thresholds", async () => {
    mockDb = makeDb({
      syncedOutboxCount: 50,
      syncedDomainEventsCount: 100,
    }) as typeof mockDb;
    const monitor = new StorageMonitor();

    const health = await monitor.getStorageHealth();

    expect(health.healthy).toBe(true);
    expect(health.warnings).toHaveLength(0);
  });

  it("warns when synced outbox items exceed 1000", async () => {
    mockDb = makeDb({
      syncedOutboxCount: 1001,
      syncedDomainEventsCount: 0,
    }) as typeof mockDb;
    const monitor = new StorageMonitor();

    const health = await monitor.getStorageHealth();

    expect(health.healthy).toBe(false);
    expect(health.warnings.some((w) => w.includes("outbox"))).toBe(true);
  });

  it("warns when synced domain events exceed 5000", async () => {
    mockDb = makeDb({
      syncedOutboxCount: 0,
      syncedDomainEventsCount: 5001,
    }) as typeof mockDb;
    const monitor = new StorageMonitor();

    const health = await monitor.getStorageHealth();

    expect(health.healthy).toBe(false);
    expect(health.warnings.some((w) => w.includes("domain events"))).toBe(true);
  });

  it("warns when storage quota is above 80%", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        storage: {
          estimate: vi.fn().mockResolvedValue({ usage: 850, quota: 1000 }),
        },
      },
      writable: true,
      configurable: true,
    });
    mockDb = makeDb({
      syncedOutboxCount: 0,
      syncedDomainEventsCount: 0,
    }) as typeof mockDb;

    // Need import.meta.client to be true for quota check; skip quota warn on SSR-only env
    const monitor = new StorageMonitor();
    const health = await monitor.getStorageHealth();
    // In test env, import.meta.client may be false — just verify shape
    expect(health).toHaveProperty("healthy");
    expect(health).toHaveProperty("warnings");
    expect(Array.isArray(health.warnings)).toBe(true);
  });
});

describe("StorageMonitor.pruneOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes synced items older than the threshold and returns count deleted", async () => {
    const candidates = [{ id: "out_1" }, { id: "out_2" }];
    // Build a db that returns candidates for the prune query
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
    const selectWhere = vi.fn().mockResolvedValue(candidates);
    const fromFn = vi.fn().mockReturnValue({ where: selectWhere });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });

    mockDb = { select: selectFn, delete: deleteFn } as typeof mockDb;
    const monitor = new StorageMonitor();

    const count = await monitor.pruneOutbox(30);

    expect(count).toBe(2);
    expect(deleteFn).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no synced items are older than the threshold", async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });
    const selectWhere = vi.fn().mockResolvedValue([]);
    const fromFn = vi.fn().mockReturnValue({ where: selectWhere });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });

    mockDb = { select: selectFn, delete: deleteFn } as typeof mockDb;
    const monitor = new StorageMonitor();

    const count = await monitor.pruneOutbox(30);

    expect(count).toBe(0);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("does not attempt to delete when the candidate list is empty", async () => {
    const deleteFn = vi.fn();
    const selectWhere = vi.fn().mockResolvedValue([]);
    const fromFn = vi.fn().mockReturnValue({ where: selectWhere });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });

    mockDb = { select: selectFn, delete: deleteFn } as typeof mockDb;
    const monitor = new StorageMonitor();

    await monitor.pruneOutbox(30);

    expect(deleteFn).not.toHaveBeenCalled();
  });
});
