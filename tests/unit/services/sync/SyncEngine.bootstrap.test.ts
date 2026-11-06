/**
 * Regression tests for SyncEngine.bootstrap() local-first behaviour.
 *
 * Bootstrap must NOT issue a network call when the entitlement snapshot is
 * already persisted to SQLite. Firing it on every page load or push cycle
 * would silently turn the app into client-server (blocked on network at
 * startup) and undo the local-first guarantee.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type * as LocalDb from "~/local-db";
import type * as SyncEngineHelpers from "~/services/sync/SyncEngine-helpers";

// Prevent Nuxt composable lifecycle errors (same pattern as concurrency tests)
vi.mock("~/composables/sync/useSyncClient", () => ({
  canEdit: vi.fn(),
  canView: vi.fn(),
  useSyncClient: vi.fn(),
  startSync: vi.fn(),
  stopSync: vi.fn(),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn().mockReturnValue({
    id: "actor-test",
    name: "Test Actor",
    roles: ["member"],
  }),
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
    getSQLocal: vi.fn(),
    isLocalDatabaseReady: vi.fn(() => true),
    waitForLocalDbReady: vi.fn().mockResolvedValue(undefined),
    nowISO: vi.fn(() => "2026-01-01T00:00:00.000Z"),
    createUuidV7: vi.fn(() => "test-uuid"),
    safeParse: actual.safeParse,
  };
});

const mockFetchEntitlementSnapshot = vi.fn();
const mockUpsertEntitlementSnapshot = vi.fn();
const mockFetchSyncCursor = vi.fn();
const mockUpsertSyncCursor = vi.fn();

vi.mock("~/services/sync/SyncEngine-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof SyncEngineHelpers>();
  return {
    ...actual,
    fetchEntitlementSnapshot: mockFetchEntitlementSnapshot,
    upsertEntitlementSnapshot: mockUpsertEntitlementSnapshot,
    fetchSyncCursor: mockFetchSyncCursor,
    upsertSyncCursor: mockUpsertSyncCursor,
  };
});

vi.mock("~/lifecycle/management", () => ({
  buildLifecycleActorHeaders: vi.fn(() => ({})),
}));

vi.mock("~/services/events/emitSystemEvent", () => ({
  emitSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

const fetchSpy = vi.fn();

describe("SyncEngine.bootstrap() — local-first XHR guard", () => {
  beforeEach(() => {
    vi.stubGlobal("$fetch", fetchSpy);
    vi.clearAllMocks();
    fetchSpy.mockResolvedValue({
      entitlements: {},
      cursors: { local: "cursor-1", remote: "cursor-1" },
    });
    mockUpsertEntitlementSnapshot.mockResolvedValue(undefined);
    mockUpsertSyncCursor.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips the network call when SQLite already has an entitlement snapshot", async () => {
    mockFetchEntitlementSnapshot.mockResolvedValue({
      id: "snap-1",
      actorId: "actor-test",
      entitlements: JSON.stringify({ "*": { canEdit: true, canView: true } }),
      snapshotVersion: 1,
      validUntil: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const { SyncEngine } = await import("~/services/sync/SyncEngine");
    const engine = new SyncEngine();
    const result = await engine.bootstrap();

    expect(result).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fires the network call on first boot (no snapshot in SQLite)", async () => {
    mockFetchEntitlementSnapshot.mockResolvedValue(null);

    const { SyncEngine } = await import("~/services/sync/SyncEngine");
    const engine = new SyncEngine();
    await engine.bootstrap();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/sync/bootstrap",
      expect.objectContaining({ method: "GET" })
    );
    expect(mockUpsertEntitlementSnapshot).toHaveBeenCalled();
    expect(mockUpsertSyncCursor).toHaveBeenCalled();
  });

  it("fires the network call again after clearLocalData wipes SQLite", async () => {
    // Simulate OPFS wipe: snapshot query returns null (table was recreated)
    mockFetchEntitlementSnapshot.mockResolvedValue(null);

    const { SyncEngine } = await import("~/services/sync/SyncEngine");
    const engine = new SyncEngine();
    await engine.bootstrap();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns true without touching SQLite when snapshot exists", async () => {
    mockFetchEntitlementSnapshot.mockResolvedValue({
      id: "snap-1",
      actorId: "actor-test",
      entitlements: JSON.stringify({}),
      snapshotVersion: 2,
      validUntil: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const { SyncEngine } = await import("~/services/sync/SyncEngine");
    const engine = new SyncEngine();
    const result = await engine.bootstrap();

    expect(result).toBe(true);
    expect(mockUpsertEntitlementSnapshot).not.toHaveBeenCalled();
    expect(mockUpsertSyncCursor).not.toHaveBeenCalled();
  });
});
