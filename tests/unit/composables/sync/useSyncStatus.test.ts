/**
 * Unit tests for useSyncStatus composable.
 * Verifies mapping from SyncEngine state to UI status.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

// ── Mock useSyncClient module-level state ─────────────────────────────────

const mockIsSyncing = ref(false);
const mockSyncError = ref<string | null>(null);
const mockPendingCount = ref(0);
const mockLastSyncAt = ref<string | null>(null);
const mockIsPullDegraded = ref(false);
const mockIsSseConnected = ref(false);
const mockHasSuccessfulSync = ref(false);

vi.mock("~/composables/sync/useSyncClient", () => ({
  isSyncing: mockIsSyncing,
  syncError: mockSyncError,
  pendingCount: mockPendingCount,
  lastSyncAt: mockLastSyncAt,
  isPullDegraded: mockIsPullDegraded,
  isSseConnected: mockIsSseConnected,
  hasSuccessfulSync: mockHasSuccessfulSync,
}));

beforeEach(() => {
  mockIsSyncing.value = false;
  mockSyncError.value = null;
  mockPendingCount.value = 0;
  mockLastSyncAt.value = null;
  mockIsPullDegraded.value = false;
  mockIsSseConnected.value = false;
  mockHasSuccessfulSync.value = false;
});

describe("useSyncStatus", () => {
  it("returns 'online' after sync succeeds with SSE connected", async () => {
    mockHasSuccessfulSync.value = true;
    mockIsSseConnected.value = true;
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("online");
  });

  it("returns 'offline' before the first successful sync", async () => {
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("offline");
  });

  it("returns 'degraded' when SSE is disconnected after a successful sync", async () => {
    mockHasSuccessfulSync.value = true;
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("degraded");
  });

  it("returns 'syncing' when isSyncing is true", async () => {
    mockIsSyncing.value = true;
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("syncing");
  });

  it("returns 'offline' when syncError is set", async () => {
    mockSyncError.value = "Network error";
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("offline");
  });

  it("syncing takes priority over error", async () => {
    mockIsSyncing.value = true;
    mockSyncError.value = "Network error";
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("syncing");
  });

  it("exposes pendingCount reactively", async () => {
    mockPendingCount.value = 5;
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { pendingCount } = useSyncStatus();
    expect(pendingCount.value).toBe(5);
  });

  it("exposes lastSyncAt reactively", async () => {
    mockLastSyncAt.value = "2026-03-26T10:00:00.000Z";
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { lastSyncAt } = useSyncStatus();
    expect(lastSyncAt.value).toBe("2026-03-26T10:00:00.000Z");
  });

  it("returns 'degraded' when pull is failing but push is working", async () => {
    mockHasSuccessfulSync.value = true;
    mockIsSseConnected.value = true;
    mockIsPullDegraded.value = true;
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("degraded");
  });

  it("syncing takes priority over degraded", async () => {
    mockIsSyncing.value = true;
    mockIsPullDegraded.value = true;
    const { useSyncStatus } = await import("~/composables/sync/useSyncStatus");
    const { status } = useSyncStatus();
    expect(status.value).toBe("syncing");
  });
});
