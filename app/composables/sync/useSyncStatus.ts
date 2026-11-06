/**
 * useSyncStatus — reactive sync state for UI indicators.
 *
 * Maps internal sync engine state to user-facing status labels
 * and exposes outbox count + last sync timestamp for tooltips.
 *
 * Status mapping:
 *   isSyncing          → 'syncing'
 *   syncError          → 'offline'
 *   pendingCount === 0 → 'online'
 *   pendingCount > 0   → 'online' (items queued but connection is up)
 */

import { computed } from "vue";
import {
  isSyncing,
  lastSyncAt,
  syncError,
  isPullDegraded,
  isSseConnected,
  hasSuccessfulSync,
  pendingCount,
} from "./useSyncClient";

export type SyncConnectionStatus =
  | "online"
  | "syncing"
  | "degraded"
  | "offline";

export function useSyncStatus() {
  const status = computed<SyncConnectionStatus>(() => {
    if (isSyncing.value) return "syncing";
    if (syncError.value || !hasSuccessfulSync.value) return "offline";
    if (isPullDegraded.value || !isSseConnected.value) return "degraded";
    return "online";
  });

  return {
    status,
    pendingCount,
    lastSyncAt,
    syncError,
    isPullDegraded,
  };
}
