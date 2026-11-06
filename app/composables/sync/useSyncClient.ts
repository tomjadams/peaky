/**
 * Local-first sync client composable.
 *
 * Thin Vue wrapper that binds SyncScheduler (pure logic) to reactive
 * state and Vue lifecycle. All scheduling, backoff, and error handling
 * lives in SyncScheduler — this file only wires it to the DOM.
 *
 * @see app/services/sync/SyncScheduler.ts — scheduling logic (ports & adapters)
 * @see app/services/sync/BackoffGate.ts — per-endpoint failure gate
 * @see app/services/sync/SyncEngine.ts — all sync logic lives here
 * @see app/services/sync/syncRunner.ts — scheduler singleton + runSyncCycle
 */

import { ref, onMounted, onUnmounted } from "vue";
import { useLocalUIStore } from "../local/useLocalUIStore";
import { syncEngine } from "~/services/sync/SyncEngine";
import { setPushCallback } from "~/services/sync/pushTrigger";
import { syncGate as defaultSyncGate } from "~/services/sync/BackoffGate";
import { SyncScheduler } from "~/services/sync/SyncScheduler";
import { syncRunner } from "~/services/sync/syncRunner";
import type { SyncPort } from "~/services/sync/SyncScheduler";
import type {
  OutboxItem,
  SyncCursor,
  SyncCycleResult,
  LocalEntitlementSnapshot,
} from "~/services/sync/SyncEngine";
import type { BackoffGate } from "~/services/sync/BackoffGate";

export type {
  OutboxItem,
  SyncCursor,
  SyncCycleResult,
  LocalEntitlementSnapshot,
};

export const runSyncCycle = syncRunner.runSyncCycle.bind(syncRunner);

// ── Reactive state (module-level singleton) ─────────────────────────────────

export const isSyncing = ref(false);
export const lastSyncAt = ref<string | null>(null);
export const syncError = ref<string | null>(null);
export const isPullDegraded = ref(false);
export const isSseConnected = ref(false);
export const hasSuccessfulSync = ref(false);
export const pendingCount = ref(0);

export const incomingFamily = ref<string | null>(null);

export const canEdit = syncEngine.canEdit.bind(syncEngine);
export const canView = syncEngine.canView.bind(syncEngine);

// ── Scheduler singleton ─────────────────────────────────────────────────────

let scheduler: SyncScheduler | null = null;

function syncReactiveState(result: SyncCycleResult): void {
  isSyncing.value = false;
  if (result.success) {
    hasSuccessfulSync.value = true;
    lastSyncAt.value = result.lastSyncAt ?? null;
    pendingCount.value = result.pendingCount;
    isPullDegraded.value = result.pullDegraded;
    syncError.value = null;
  } else {
    syncError.value = result.error ?? "Sync failed";
    isPullDegraded.value = false;
  }
}

/**
 * Signal whether an SSE connection is active.
 *
 * When connected, scheduled polling is suppressed — SSE messages trigger
 * sync cycles on demand. When disconnected, polling resumes as fallback.
 * Push callbacks and visibility-change cycles run regardless.
 */
export function setSseConnected(connected: boolean): void {
  isSseConnected.value = connected;
  scheduler?.setSseConnected(connected);
}

// ── Composable ──────────────────────────────────────────────────────────────

export interface SyncClientDeps {
  engine?: SyncPort;
  gate?: BackoffGate;
  registerPush?: (cb: () => void) => void;
}

export function useSyncClient(deps?: SyncClientDeps) {
  if (!scheduler) {
    const uiStore = useLocalUIStore();
    scheduler = new SyncScheduler({
      engine: deps?.engine ?? syncEngine,
      gate: deps?.gate ?? defaultSyncGate,
      registerPush: deps?.registerPush ?? setPushCallback,
      onCycleComplete: syncReactiveState,
      onDowngrade: () => uiStore.setSyncStatus("has_downgrades"),
    });
    syncRunner.setScheduler(scheduler);
  }

  onMounted(() => {
    scheduler!.start();
  });

  onUnmounted(() => {
    // Don't stop on unmount — singleton service
  });

  return {
    isSyncing,
    lastSyncAt,
    syncError,
    pendingCount,
    runSyncCycle,
    startSync: () => scheduler!.start(),
    stopSync: () => scheduler!.stop(),
  };
}
