/**
 * Unit tests for SyncScheduler — pure logic, zero vi.mock.
 *
 * All dependencies are plain objects injected via constructor.
 * BackoffGate is a real instance. SyncPort is a minimal fake.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncScheduler } from "~/services/sync/SyncScheduler";
import type { SyncPort } from "~/services/sync/SyncScheduler";
import { BackoffGate } from "~/services/sync/BackoffGate";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fakeEngine(overrides?: Partial<SyncPort>): SyncPort {
  return {
    runSyncCycle: async () => ({
      success: true,
      pullDegraded: false,
      pendingCount: 0,
      lastSyncAt: "2026-01-01T00:00:00Z",
    }),
    refreshEntitlements: async () => ({ hasDowngrades: false }),
    ...overrides,
  };
}

function createScheduler(opts?: {
  engine?: Partial<SyncPort>;
  gate?: BackoffGate;
  registerPush?: (cb: () => void) => void;
  onDowngrade?: () => void;
  intervalMs?: number;
}) {
  const gate = opts?.gate ?? new BackoffGate({ baseMs: 100, capMs: 1000 });
  const engine = fakeEngine(opts?.engine);
  const scheduler = new SyncScheduler({
    engine,
    gate,
    registerPush: opts?.registerPush ?? (() => {}),
    onDowngrade: opts?.onDowngrade,
    intervalMs: opts?.intervalMs ?? 100,
  });
  return { scheduler, engine, gate };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SyncScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── runCycle ──────────────────────────────────────────────────────────

  describe("runCycle", () => {
    it("GIVEN a healthy engine WHEN runCycle completes THEN returns success and records gate success", async () => {
      const { scheduler, gate } = createScheduler();

      const result = await scheduler.runCycle();

      expect(result.success).toBe(true);
      expect(gate.isHealthy).toBe(true);
      expect(gate.consecutiveFailures).toBe(0);
    });

    it("GIVEN a failing engine WHEN runCycle completes THEN returns failure and records gate failure", async () => {
      const { scheduler, gate } = createScheduler({
        engine: {
          runSyncCycle: async () => ({
            success: false,
            error: "Server error",
            pullDegraded: false,
            pendingCount: 0,
          }),
        },
      });

      const result = await scheduler.runCycle();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
      expect(gate.consecutiveFailures).toBe(1);
    });

    it("GIVEN a cycle in flight WHEN runCycle is called again THEN skips without calling engine", async () => {
      const runSyncCycle = vi.fn(
        () =>
          new Promise<
            ReturnType<SyncPort["runSyncCycle"]> extends Promise<infer R>
              ? R
              : never
          >(() => {
            // never resolves — simulates in-flight cycle
          })
      );
      const { scheduler } = createScheduler({ engine: { runSyncCycle } });

      void scheduler.runCycle();
      const second = await scheduler.runCycle();

      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      expect(second.success).toBe(true); // early return
    });

    it("GIVEN consecutive failures WHEN a cycle succeeds THEN gate resets", async () => {
      const results = [
        { success: false, error: "down", pullDegraded: false, pendingCount: 0 },
        { success: false, error: "down", pullDegraded: false, pendingCount: 0 },
        {
          success: true,
          pullDegraded: false,
          pendingCount: 0,
          lastSyncAt: "t",
        },
      ];
      let callIdx = 0;
      const { scheduler, gate } = createScheduler({
        engine: { runSyncCycle: async () => results[callIdx++]! },
      });

      await scheduler.runCycle();
      await scheduler.runCycle();
      expect(gate.consecutiveFailures).toBe(2);

      await scheduler.runCycle();
      expect(gate.consecutiveFailures).toBe(0);
      expect(gate.isHealthy).toBe(true);
    });

    it("GIVEN pullDegraded WHEN cycle succeeds THEN result carries pullDegraded", async () => {
      const { scheduler } = createScheduler({
        engine: {
          runSyncCycle: async () => ({
            success: true,
            pullDegraded: true,
            pendingCount: 3,
            lastSyncAt: "t",
          }),
        },
      });

      const result = await scheduler.runCycle();

      expect(result.pullDegraded).toBe(true);
      expect(result.pendingCount).toBe(3);
    });

    it("GIVEN a completed cycle THEN lastResult is set", async () => {
      const { scheduler } = createScheduler();

      expect(scheduler.lastResult).toBeNull();
      await scheduler.runCycle();
      expect(scheduler.lastResult?.success).toBe(true);
    });
  });

  // ── Push gating ───────────────────────────────────────────────────────

  describe("push gating", () => {
    it("GIVEN a healthy gate WHEN push fires THEN cycle runs", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      let pushCb: (() => void) | null = null;
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        registerPush: (cb) => {
          pushCb = cb;
        },
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0); // let initial cycle settle
      runSyncCycle.mockClear();

      pushCb!();
      await vi.advanceTimersByTimeAsync(0); // let push cycle settle

      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });

    it("GIVEN a failing gate WHEN push fires THEN cycle is skipped", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: false,
        error: "down",
        pullDegraded: false,
        pendingCount: 0,
      }));
      let pushCb: (() => void) | null = null;
      const gate = new BackoffGate({ baseMs: 100, capMs: 1000 });
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        gate,
        registerPush: (cb) => {
          pushCb = cb;
        },
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0); // initial cycle runs and fails
      runSyncCycle.mockClear();

      // gate is now unhealthy — push should be gated
      pushCb!();
      await vi.advanceTimersByTimeAsync(0);

      expect(runSyncCycle).not.toHaveBeenCalled();
      scheduler.stop();
    });
  });

  // ── Scheduling ────────────────────────────────────────────────────────

  describe("scheduling", () => {
    it("GIVEN a healthy gate WHEN started THEN schedules next cycle at intervalMs", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        intervalMs: 500,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0); // initial cycle
      runSyncCycle.mockClear();

      await vi.advanceTimersByTimeAsync(499);
      expect(runSyncCycle).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });

    it("GIVEN consecutive failures WHEN scheduling THEN uses gate.delay() backoff", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1); // deterministic jitter
      const runSyncCycle = vi.fn(async () => ({
        success: false,
        error: "down",
        pullDegraded: false,
        pendingCount: 0,
      }));
      const gate = new BackoffGate({ baseMs: 100, capMs: 10_000 });
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        gate,
        intervalMs: 100,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0); // initial cycle → failure #1

      // First scheduled cycle fires at intervalMs (100ms) because
      // schedule() was called before the initial cycle completed.
      await vi.advanceTimersByTimeAsync(100); // failure #2
      runSyncCycle.mockClear();

      // After 2 failures: gate.delay() = 100 * 2^2 * 1.0 = 400ms
      await vi.advanceTimersByTimeAsync(399);
      expect(runSyncCycle).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });

    it("GIVEN stop is called WHEN timeout is pending THEN clears it", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        intervalMs: 500,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);
      runSyncCycle.mockClear();

      scheduler.stop();
      await vi.advanceTimersByTimeAsync(1000);
      expect(runSyncCycle).not.toHaveBeenCalled();
    });
  });

  // ── SSE-aware poll suppression ──────────────────────────────────────────

  describe("SSE-aware polling", () => {
    it("GIVEN SSE connected WHEN poll interval fires THEN cycle is suppressed", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        intervalMs: 500,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0); // initial cycle
      runSyncCycle.mockClear();

      scheduler.setSseConnected(true);

      await vi.advanceTimersByTimeAsync(1000); // well past interval
      expect(runSyncCycle).not.toHaveBeenCalled();
      scheduler.stop();
    });

    it("GIVEN SSE disconnects WHEN poll interval fires THEN polling resumes", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        intervalMs: 500,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);
      runSyncCycle.mockClear();

      scheduler.setSseConnected(true);
      await vi.advanceTimersByTimeAsync(1000);
      expect(runSyncCycle).not.toHaveBeenCalled();

      scheduler.setSseConnected(false);
      await vi.advanceTimersByTimeAsync(500);
      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });

    it("GIVEN SSE connected WHEN push fires THEN cycle still runs", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      let pushCb: (() => void) | null = null;
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
        registerPush: (cb) => {
          pushCb = cb;
        },
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);
      runSyncCycle.mockClear();

      scheduler.setSseConnected(true);
      pushCb!();
      await vi.advanceTimersByTimeAsync(0);

      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });

    it("GIVEN SSE connected WHEN tab becomes visible THEN cycle still runs", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);
      runSyncCycle.mockClear();

      scheduler.setSseConnected(true);

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);

      expect(runSyncCycle).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });
  });

  // ── Visibility change ─────────────────────────────────────────────────

  describe("visibility change", () => {
    it("GIVEN tab becomes visible WHEN entitlements have downgrades THEN onDowngrade fires", async () => {
      const onDowngrade = vi.fn();
      const { scheduler } = createScheduler({
        engine: {
          refreshEntitlements: async () => ({ hasDowngrades: true }),
        },
        onDowngrade,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);

      expect(onDowngrade).toHaveBeenCalledTimes(1);
      scheduler.stop();
    });

    it("GIVEN tab becomes hidden WHEN visibility changes THEN no cycle runs", async () => {
      const runSyncCycle = vi.fn(async () => ({
        success: true,
        pullDegraded: false,
        pendingCount: 0,
      }));
      const { scheduler } = createScheduler({
        engine: { runSyncCycle },
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(0);
      runSyncCycle.mockClear();

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);

      expect(runSyncCycle).not.toHaveBeenCalled();
      scheduler.stop();
    });
  });
});
