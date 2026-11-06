/**
 * Tests for ConcurrencyController adaptive batch sizing.
 *
 * ConcurrencyController is exported from SyncEngine.ts but has no external
 * dependencies. We test it directly without importing the SyncEngine class
 * (which transitively loads composables that need the Nuxt lifecycle).
 */
import { describe, it, expect, vi } from "vitest";
import type * as LocalDb from "~/local-db";

import { ConcurrencyController } from "~/services/sync/SyncEngine";

// useSyncClient.ts (auto-imported by Nuxt) has a top-level statement:
//   export const canEdit = syncEngine.canEdit.bind(syncEngine)
// This fails when syncEngine is undefined due to module circular resolution.
// Mock useSyncClient to prevent the crash.
vi.mock("~/composables/useSyncClient", () => ({
  canEdit: vi.fn(),
  canView: vi.fn(),
  useSyncClient: vi.fn(),
  startSync: vi.fn(),
  stopSync: vi.fn(),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn().mockReturnValue({
    id: "user-test",
    name: "Test User",
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
  };
});

describe("ConcurrencyController — batch size adaptation", () => {
  it("initial batch size matches configured initial value", () => {
    const cc = new ConcurrencyController({ initial: 5, max: 20, min: 1 });
    expect(cc.batchSize).toBe(5);
  });

  it("defaults to initial=5, max=20, min=1 when no config is provided", () => {
    const cc = new ConcurrencyController();
    expect(cc.batchSize).toBe(5);
  });

  it("onSuccess increases batch size by 50% (floor)", () => {
    const cc = new ConcurrencyController({ initial: 4, max: 20, min: 1 });
    cc.onSuccess();
    // floor(4 * 1.5) = 6
    expect(cc.batchSize).toBe(6);
  });

  it("onSuccess makes progress from every size below max, including min", () => {
    // floor(1 * 1.5) === 1, so proportional growth alone strands a controller
    // that has collapsed to min at one item per cycle for the rest of the
    // session. Exhaustive over the whole domain, not just the boundary.
    for (let initial = 1; initial < 20; initial++) {
      const cc = new ConcurrencyController({ initial, max: 20, min: 1 });
      cc.onSuccess();
      expect(cc.batchSize).toBeGreaterThan(initial);
    }
  });

  it("recovers from min back to max under repeated success", () => {
    const cc = new ConcurrencyController({ initial: 1, max: 20, min: 1 });
    for (let i = 0; i < 20; i++) cc.onSuccess();
    expect(cc.batchSize).toBe(20);
  });

  it("onSuccess clamps to max", () => {
    const cc = new ConcurrencyController({ initial: 16, max: 20, min: 1 });
    cc.onSuccess();
    // floor(16 * 1.5) = 24, clamped to 20
    expect(cc.batchSize).toBe(20);
  });

  it("onFailure halves the batch size (floor)", () => {
    const cc = new ConcurrencyController({ initial: 10, max: 20, min: 1 });
    cc.onFailure();
    // floor(10 / 2) = 5
    expect(cc.batchSize).toBe(5);
  });

  it("onFailure clamps to min and never goes below it", () => {
    const cc = new ConcurrencyController({ initial: 1, max: 20, min: 1 });
    cc.onFailure();
    // floor(1 / 2) = 0, clamped to 1
    expect(cc.batchSize).toBe(1);
  });

  it("batch size never exceeds maxBatchSize across multiple successes", () => {
    const cc = new ConcurrencyController({ initial: 5, max: 20, min: 1 });
    for (let i = 0; i < 20; i++) {
      cc.onSuccess();
    }
    expect(cc.batchSize).toBeLessThanOrEqual(20);
  });

  it("multiple successes then failure resets correctly", () => {
    const cc = new ConcurrencyController({ initial: 4, max: 20, min: 1 });
    // 4 → 6 → 9 → 13 → 19 → 20 (capped)
    cc.onSuccess(); // 6
    cc.onSuccess(); // 9
    cc.onSuccess(); // 13
    cc.onSuccess(); // 19
    cc.onSuccess(); // 20 (capped)
    expect(cc.batchSize).toBe(20);

    cc.onFailure(); // floor(20/2) = 10
    expect(cc.batchSize).toBe(10);
  });
});
