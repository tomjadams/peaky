/**
 * Sync scheduling logic — pure class, no singletons, no Vue imports.
 *
 * Owns the sync cycle loop, visibility-change handling, push gating,
 * and backoff. All dependencies injected via constructor.
 *
 * Architecture (ports and adapters):
 *
 *   SyncPort          BackoffGate         SyncScheduler
 *   ──────────        ───────────         ─────────────
 *   runSyncCycle()  ← gate.delay()     →  scheduleCycle()
 *   refreshEntitlements()               →  runCycle()
 *                   ← gate.mayAttempt() →  pushCallback()
 *                   ← recordSuccess()
 *                   ← recordFailure()
 *
 *   Tests inject fakes for SyncPort — no vi.mock needed.
 *   Production wires the real SyncEngine singleton.
 *
 * @see app/composables/sync/useSyncClient.ts — Vue wrapper
 * @see app/services/sync/BackoffGate.ts — per-endpoint failure gate
 */

import type { BackoffGate } from "./BackoffGate";
import type { SyncCycleResult } from "./SyncEngine";

export type { SyncCycleResult };

/** Port — what the scheduler needs from the sync engine. */
export interface SyncPort {
  runSyncCycle(opts?: { skipBootstrap?: boolean }): Promise<SyncCycleResult>;
  refreshEntitlements(): Promise<{ hasDowngrades: boolean }>;
}

export interface SyncSchedulerDeps {
  engine: SyncPort;
  gate: BackoffGate;
  registerPush: (cb: () => void) => void;
  onCycleComplete?: (result: SyncCycleResult) => void;
  onDowngrade?: () => void;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 30_000;

export class SyncScheduler {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;
  private pendingRerun = false;
  private sseConnected = false;
  private readonly engine: SyncPort;
  private readonly gate: BackoffGate;
  private readonly registerPush: SyncSchedulerDeps["registerPush"];
  private readonly onCycleComplete: (result: SyncCycleResult) => void;
  private readonly onDowngrade: () => void;
  private readonly intervalMs: number;

  /** Last cycle result — exposed for reactive state binding. */
  lastResult: SyncCycleResult | null = null;

  constructor(deps: SyncSchedulerDeps) {
    this.engine = deps.engine;
    this.gate = deps.gate;
    this.registerPush = deps.registerPush;
    this.onCycleComplete = deps.onCycleComplete ?? (() => {});
    this.onDowngrade = deps.onDowngrade ?? (() => {});
    this.intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;
  }

  /**
   * Run a single sync cycle and update the gate.
   *
   * Returns `SyncCycleResult` (error-as-value) — never throws.
   * If a cycle is already in flight, marks a re-run as needed so the
   * current cycle's completion triggers a follow-up that picks up any
   * outbox items written while the first cycle was busy.
   */
  async runCycle(opts?: { skipBootstrap?: boolean }): Promise<SyncCycleResult> {
    if (this.syncing) {
      this.pendingRerun = true;
      return { success: true, pullDegraded: false, pendingCount: 0 };
    }

    this.syncing = true;
    const result = await this.engine.runSyncCycle(opts);
    this.syncing = false;

    if (result.success) {
      this.gate.recordSuccess();
    } else {
      this.gate.recordFailure();
    }

    this.lastResult = result;
    this.onCycleComplete(result);

    // If a push trigger fired while we were busy, run a follow-up cycle
    // so outbox items written during the first cycle get pushed.
    if (this.pendingRerun) {
      this.pendingRerun = false;
      void this.runCycle({ skipBootstrap: true });
    }

    return result;
  }

  /** Start the scheduled sync loop, push callback, and visibility listener. */
  start(): void {
    if (this.timeout) return;

    this.registerPush(() => {
      if (this.gate.mayAttempt()) {
        void this.runCycle({ skipBootstrap: true });
      }
    });

    void this.runCycle();
    this.schedule();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
  }

  /** Stop the scheduled loop and remove listeners. */
  stop(): void {
    this.pendingRerun = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
  }

  /** Whether a cycle is currently in flight. */
  get isSyncing(): boolean {
    return this.syncing;
  }

  /**
   * Signal whether an SSE connection is active.
   *
   * When SSE is connected, scheduled polling is suppressed — SSE messages
   * trigger sync cycles on demand. Push callbacks and visibility-change
   * cycles still run regardless.
   *
   * When SSE disconnects, polling resumes automatically as a fallback.
   */
  setSseConnected(connected: boolean): void {
    this.sseConnected = connected;
    if (connected && this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (!connected && !this.timeout) {
      this.schedule();
    }
  }

  // ── Private ─────────────────────────────────────────────────────────

  private schedule(): void {
    if (this.timeout) return;
    if (this.sseConnected) return;
    const delay = this.gate.isHealthy ? this.intervalMs : this.gate.delay();
    this.timeout = setTimeout(async () => {
      this.timeout = null;
      await this.runCycle({ skipBootstrap: true });
      this.schedule();
    }, delay);
  }

  private onVisibilityChange = async (): Promise<void> => {
    if (document.visibilityState !== "visible") return;

    const result = await this.engine.refreshEntitlements();
    if (result.hasDowngrades) {
      this.onDowngrade();
    }

    await this.runCycle({ skipBootstrap: true });
  };
}
