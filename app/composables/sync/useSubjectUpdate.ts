/**
 * Reactive indicator for SSE-triggered updates scoped to a catalog family.
 *
 * The SSE frame is a family-level doorbell (`sync:{family}:catalog`), so the
 * signal is now family-grained: returns true only while an SSE-triggered pull
 * is in flight AND the frame's family matches the provided family. 30s polling
 * cycles never set this — they are not family-scoped.
 *
 * Per-subject matching was removed with the family-catalog channel contract:
 * the doorbell no longer carries a subject id. Whether a family-level cue is
 * the right UX (vs per-subject, vs dropped) is the open GAP-8 decision.
 *
 * Usage:
 *   const { isReceivingUpdate } = useSubjectUpdate("review")
 *
 * @see app/composables/sync/useSyncClient.ts — incomingFamily source
 * @see app/composables/sync/useSseClient.ts  — sets/clears incomingFamily
 * @see app/components/sync/SubjectUpdateIndicator.vue — ready-made component
 */

import { computed, toValue, type MaybeRef, type ComputedRef } from "vue";
import { incomingFamily } from "~/composables/sync/useSyncClient";

export function useSubjectUpdate(family: MaybeRef<string | undefined>): {
  isReceivingUpdate: ComputedRef<boolean>;
} {
  const isReceivingUpdate = computed(() => {
    const f = toValue(family);
    if (!f || !incomingFamily.value) return false;
    return incomingFamily.value === f;
  });

  return { isReceivingUpdate };
}
