/**
 * Scheduler singleton holder — decouples the sync composable from consumers
 * that need to trigger a sync cycle (test-seed plugin, SSE client) without
 * importing a Vue composable.
 *
 * The composable creates the SyncScheduler and registers it here; callers
 * use {@link SyncRunner.runSyncCycle} to trigger a cycle without depending
 * on the composable module.
 */

import type { SyncScheduler } from "~/services/sync/SyncScheduler";
import type { SyncCycleResult } from "~/services/sync/SyncEngine";

export class SyncRunner {
  private scheduler: SyncScheduler | null = null;

  /** Register the scheduler singleton (called once by useSyncClient). */
  setScheduler(s: SyncScheduler | null): void {
    this.scheduler = s;
  }

  /** True when the scheduler singleton has been registered by useSyncClient. */
  isRegistered(): boolean {
    return this.scheduler !== null;
  }

  /**
   * Run a sync cycle via the registered scheduler.
   * Returns a no-op success if the scheduler has not been created yet.
   */
  async runSyncCycle(opts?: {
    skipBootstrap?: boolean;
  }): Promise<SyncCycleResult> {
    if (!this.scheduler) {
      return { success: true, pullDegraded: false, pendingCount: 0 };
    }
    return this.scheduler.runCycle(opts);
  }
}

export const syncRunner = new SyncRunner();
