/**
 * SSE fan-out client composable.
 *
 * Opens one persistent `fetch`-based SSE connection (not native EventSource —
 * EventSource cannot set headers, which blocks Okta JWT auth in Phase 3).
 *
 * On message: fires an immediate sync cycle via the shared runSyncCycle()
 * from useSyncClient. The polling interval continues uninterrupted as
 * a fallback on SSE disruption.
 *
 * Backoff: accepts a `BackoffGate` via dependency injection (defaults to
 * `sseGate`). Sync polling has its own `syncGate` so SSE failures don't
 * throttle push/pull. See BackoffGate.ts for design.
 *
 * @see app/services/sync/BackoffGate.ts — per-endpoint failure gate
 * @see app/composables/sync/useSyncClient.ts — polling fallback + bootstrap
 * @see services/cmd/peaky-sse/main.go — server side
 */

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { onMounted, onUnmounted } from "vue";
import {
  runSyncCycle,
  setSseConnected,
  incomingFamily,
} from "~/composables/sync/useSyncClient";
import { buildLifecycleActorHeaders } from "~/lifecycle/management";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import {
  type BackoffGate,
  sseGate as defaultSseGate,
} from "~/services/sync/BackoffGate";

interface CursorNotification {
  cursor: string;
  family: string;
}

export function useSseClient(opts?: { gate?: BackoffGate }) {
  if (!import.meta.client) return;

  const gate = opts?.gate ?? defaultSseGate;
  let abortController: AbortController | null = null;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let latestFrameId = 0;

  function scheduleReconnect(): void {
    if (retryTimeout) return;
    const delay = gate.delay();
    if (import.meta.dev) {
      console.debug(
        `[useSseClient] scheduling reconnect in ${Math.round(delay / 1000)}s`
      );
    }
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      connect();
    }, delay);
  }

  function connect(): void {
    if (!gate.mayAttempt()) {
      scheduleReconnect();
      return;
    }

    abortController = new AbortController();
    const actor = readPersistedActor();
    const headers = buildLifecycleActorHeaders(actor);

    fetchEventSource("/api/sse/events", {
      headers,
      signal: abortController.signal,
      onopen: async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.includes("text/event-stream")) {
          throw new Error(
            `SSE connection failed with status ${response.status}`
          );
        }
        gate.recordSuccess();
        setSseConnected(true);
      },
      onmessage(ev) {
        if (!ev.data) return;
        try {
          const event = JSON.parse(ev.data) as Partial<CursorNotification>;
          // The frame is a content-free doorbell: ring it (runSyncCycle) no
          // matter what. `family` only drives the cosmetic page indicator, so a
          // missing/old-shape field just leaves the indicator dark.
          const family = typeof event.family === "string" ? event.family : null;
          const frameId = ++latestFrameId;
          incomingFamily.value = family;
          void runSyncCycle()
            .finally(() => {
              // Only the most recent frame clears the indicator, so an older
              // cycle can't stomp a newer same-family frame still in flight.
              if (latestFrameId === frameId) incomingFamily.value = null;
            })
            .catch(() => {});
        } catch {
          // Ignore malformed SSE frames — poll is the safety net.
        }
      },
      onerror() {
        gate.recordFailure();
        setSseConnected(false);
        abortController?.abort();
        scheduleReconnect();
        throw new Error("abort"); // stop fetchEventSource's built-in retry
      },
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.message === "abort") return;
      console.error("[useSseClient] unexpected SSE error:", err);
    });
  }

  onMounted(connect);

  onUnmounted(() => {
    setSseConnected(false);
    abortController?.abort();
    abortController = null;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  });
}
