/**
 * Decoupled push trigger — lets non-Vue modules (e.g. LocalMutation) signal
 * that new outbox items are ready without importing the Vue composable layer.
 *
 * useSyncClient registers the callback once on startSync().
 * localMutation.draft() calls triggerPush() after writing to the outbox.
 *
 * localWriteAt is updated on every triggerPush() so that UI composables
 * (e.g. useFieldVersions) can watch for local mutations independently of
 * the sync cycle. This enables Recent Changes to refresh immediately on
 * local saves even when the sync backend is unreachable.
 */
import { ref } from "vue";

type PushCallback = () => void;
let pushCallback: PushCallback | null = null;

export function setPushCallback(cb: PushCallback): void {
  pushCallback = cb;
}

/** Increments on every local mutation — watch this to react to local writes. */
export const localWriteAt = ref(0);

export function notifyLocalWrite(): void {
  localWriteAt.value++;
}

export function triggerPush(): void {
  notifyLocalWrite();
  pushCallback?.();
}
