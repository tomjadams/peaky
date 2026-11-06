import { afterEach, describe, expect, it, vi } from "vitest";
import { BackoffGate } from "~/services/sync/BackoffGate";

describe("BackoffGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── delay() ───────────────────────────────────────────────────────────

  describe("delay()", () => {
    it("returns baseMs when healthy (no failures)", () => {
      const gate = new BackoffGate({ baseMs: 30_000, capMs: 300_000 });
      expect(gate.delay()).toBe(30_000);
    });

    it("doubles on each consecutive failure with jitter", () => {
      vi.spyOn(Math, "random").mockReturnValue(1); // max jitter → 100% of capped
      const gate = new BackoffGate({ baseMs: 1_000, capMs: 300_000 });

      gate.recordFailure();
      expect(gate.delay()).toBe(2_000); // 1000 * 2^1

      gate.recordFailure();
      expect(gate.delay()).toBe(4_000); // 1000 * 2^2

      gate.recordFailure();
      expect(gate.delay()).toBe(8_000); // 1000 * 2^3
    });

    it("caps at capMs", () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      const gate = new BackoffGate({ baseMs: 1_000, capMs: 5_000 });

      for (let i = 0; i < 20; i++) gate.recordFailure();
      expect(gate.delay()).toBe(5_000);
    });

    it("applies jitter between 50% and 100% of capped value", () => {
      const gate = new BackoffGate({ baseMs: 1_000, capMs: 300_000 });
      gate.recordFailure(); // exponential = 2000

      vi.spyOn(Math, "random").mockReturnValue(0); // 50% of 2000
      expect(gate.delay()).toBe(1_000);

      vi.spyOn(Math, "random").mockReturnValue(1); // 100% of 2000
      expect(gate.delay()).toBe(2_000);
    });

    it("resets to baseMs after recordSuccess()", () => {
      const gate = new BackoffGate({ baseMs: 30_000, capMs: 300_000 });
      gate.recordFailure();
      gate.recordFailure();
      gate.recordSuccess();
      expect(gate.delay()).toBe(30_000);
    });
  });

  // ── mayAttempt() ──────────────────────────────────────────────────────

  describe("mayAttempt()", () => {
    it("returns true when healthy", () => {
      const gate = new BackoffGate();
      expect(gate.mayAttempt()).toBe(true);
    });

    it("returns false immediately after a failure (cooldown not elapsed)", () => {
      vi.spyOn(Date, "now").mockReturnValue(1000);
      const gate = new BackoffGate({ baseMs: 30_000, capMs: 300_000 });
      gate.recordFailure();

      // Still at t=1000 — cooldown hasn't elapsed
      expect(gate.mayAttempt()).toBe(false);
    });

    it("returns true once cooldown has elapsed after failure", () => {
      const gate = new BackoffGate({ baseMs: 1_000, capMs: 300_000 });
      vi.spyOn(Math, "random").mockReturnValue(1); // delay = 2000ms for 1 failure

      vi.spyOn(Date, "now").mockReturnValue(1000);
      gate.recordFailure();

      // t=2999 — not yet (1000 + 2000 = 3000 needed)
      vi.spyOn(Date, "now").mockReturnValue(2999);
      expect(gate.mayAttempt()).toBe(false);

      // t=3000 — exactly at cooldown
      vi.spyOn(Date, "now").mockReturnValue(3000);
      expect(gate.mayAttempt()).toBe(true);
    });

    it("returns true after recordSuccess() resets the gate", () => {
      const gate = new BackoffGate({ baseMs: 30_000, capMs: 300_000 });
      vi.spyOn(Date, "now").mockReturnValue(1000);
      gate.recordFailure();
      expect(gate.mayAttempt()).toBe(false);

      gate.recordSuccess();
      expect(gate.mayAttempt()).toBe(true);
    });
  });

  // ── isHealthy / consecutiveFailures ───────────────────────────────────

  describe("isHealthy and consecutiveFailures", () => {
    it("starts healthy with 0 failures", () => {
      const gate = new BackoffGate();
      expect(gate.isHealthy).toBe(true);
      expect(gate.consecutiveFailures).toBe(0);
    });

    it("tracks consecutive failures", () => {
      const gate = new BackoffGate();
      gate.recordFailure();
      gate.recordFailure();
      gate.recordFailure();
      expect(gate.consecutiveFailures).toBe(3);
      expect(gate.isHealthy).toBe(false);
    });

    it("resets on success", () => {
      const gate = new BackoffGate();
      gate.recordFailure();
      gate.recordFailure();
      gate.recordSuccess();
      expect(gate.consecutiveFailures).toBe(0);
      expect(gate.isHealthy).toBe(true);
    });
  });

  // ── Per-endpoint isolation ────────────────────────────────────────────

  describe("per-endpoint isolation", () => {
    it("two gates are fully independent — failures in one don't affect the other", () => {
      const syncGate = new BackoffGate({ baseMs: 30_000, capMs: 300_000 });
      const sseGate = new BackoffGate({ baseMs: 1_000, capMs: 120_000 });

      sseGate.recordFailure();
      sseGate.recordFailure();
      sseGate.recordFailure();

      expect(sseGate.consecutiveFailures).toBe(3);
      expect(sseGate.isHealthy).toBe(false);

      // syncGate is completely unaffected
      expect(syncGate.consecutiveFailures).toBe(0);
      expect(syncGate.isHealthy).toBe(true);
      expect(syncGate.mayAttempt()).toBe(true);
    });
  });

  // ── Constructor defaults ──────────────────────────────────────────────

  describe("constructor defaults", () => {
    it("defaults to baseMs=30000, capMs=300000", () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      const gate = new BackoffGate();
      expect(gate.delay()).toBe(30_000); // healthy → baseMs

      gate.recordFailure();
      expect(gate.delay()).toBe(60_000); // 30000 * 2^1
    });
  });
});
