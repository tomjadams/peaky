/**
 * useHandoffSyncGate — the reactive binding of the degraded-sync handoff
 * gate (local-first/REQ-012; AC-019, AC-020) to the client's existing
 * sync-health detection (useSyncStatus). Group 10 wires this into the
 * handoff UI: draft controls read `draftEditing`, confirmation controls read
 * `confirmation` and surface its reason.
 */
import { computed } from "vue";
import { useSyncStatus } from "~/composables/sync/useSyncStatus";
import {
  handoffSyncGate,
  type HandoffSyncGate,
} from "~/services/handoff/syncGate";

export function useHandoffSyncGate() {
  const { status } = useSyncStatus();
  const gate = computed<HandoffSyncGate>(() => handoffSyncGate(status.value));
  return { gate };
}
