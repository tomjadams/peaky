/**
 * Unit tests for useSyncClient composable.
 *
 * The composable is a thin Vue wrapper over SyncScheduler. These tests
 * verify the reactive state binding — all scheduling/backoff logic is
 * tested in SyncScheduler.test.ts (zero mocks).
 *
 * SyncEngine is the only vi.mock (makes HTTP calls). BackoffGate and
 * SyncScheduler are real instances injected via DI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackoffGate } from "~/services/sync/BackoffGate";
import type { SyncPort } from "~/services/sync/SyncScheduler";

// SyncEngine mock — only needed because the module-level `canEdit`/`canView`
// bindings reference the singleton at import time.
vi.mock("~/services/sync/SyncEngine", () => ({
  syncEngine: {
    runSyncCycle: vi.fn(async () => ({
      success: true,
      pullDegraded: false,
      pendingCount: 0,
    })),
    refreshEntitlements: vi.fn(async () => ({ hasDowngrades: false })),
    canEdit: vi.fn(() => true),
    canView: vi.fn(() => true),
    bootstrap: vi.fn(),
    pushChanges: vi.fn(),
    pullChanges: vi.fn(),
  },
}));

vi.mock("~/services/sync/pushTrigger", () => ({
  setPushCallback: vi.fn(),
}));

vi.mock("../local/useLocalUIStore", () => ({
  useLocalUIStore: vi.fn(() => ({ setSyncStatus: vi.fn() })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useSyncClient — reactive state binding", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GIVEN a successful cycle WHEN runSyncCycle is called THEN reactive state updates", async () => {
    const engine: SyncPort = {
      runSyncCycle: async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 2,
        lastSyncAt: "2026-06-02T10:00:00Z",
      }),
      refreshEntitlements: async () => ({ hasDowngrades: false }),
    };

    const { useSyncClient, syncError, pendingCount, lastSyncAt, isSyncing } =
      await import("~/composables/sync/useSyncClient");

    // Wire the scheduler with injected deps (no mounting needed for runSyncCycle)
    useSyncClient({ engine, gate: new BackoffGate() });

    const { runSyncCycle } = await import("~/composables/sync/useSyncClient");
    const result = await runSyncCycle();

    expect(result.success).toBe(true);
    expect(syncError.value).toBeNull();
    expect(pendingCount.value).toBe(2);
    expect(lastSyncAt.value).toBe("2026-06-02T10:00:00Z");
    expect(isSyncing.value).toBe(false);
  });

  it("GIVEN a failing cycle WHEN runSyncCycle is called THEN syncError is set", async () => {
    const engine: SyncPort = {
      runSyncCycle: async () => ({
        success: false,
        error: "Server down",
        pullDegraded: false,
        pendingCount: 0,
      }),
      refreshEntitlements: async () => ({ hasDowngrades: false }),
    };

    const { useSyncClient, syncError } =
      await import("~/composables/sync/useSyncClient");

    useSyncClient({ engine, gate: new BackoffGate() });

    const { runSyncCycle } = await import("~/composables/sync/useSyncClient");
    await runSyncCycle();

    expect(syncError.value).toBe("Server down");
  });
});
