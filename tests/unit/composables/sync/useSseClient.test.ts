/**
 * Unit tests for useSseClient composable.
 *
 * Verifies SSE connection lifecycle, message handling, and backoff gate
 * integration. Uses dependency injection for BackoffGate — no vi.mock needed
 * for the gate, tests pass a real instance and inspect its state directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { BackoffGate } from "~/services/sync/BackoffGate";

// ── Mocks ─────────────────────────────────────────────────────────────────────

let capturedOnMessage: ((ev: { data: string }) => void) | null = null;
let capturedOnOpen: ((response: Response) => Promise<void>) | null = null;
let capturedOnError: (() => void) | null = null;
let capturedSignal: AbortSignal | null = null;
let fetchEventSourceCallCount = 0;
let fetchEventSourceUrl = "";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(
    (
      url: string,
      opts: {
        signal?: AbortSignal;
        onopen?: (response: Response) => Promise<void>;
        onmessage?: (ev: { data: string }) => void;
        onerror?: () => void;
      }
    ) => {
      fetchEventSourceUrl = url;
      capturedSignal = opts.signal ?? null;
      capturedOnMessage = opts.onmessage ?? null;
      capturedOnOpen = opts.onopen ?? null;
      capturedOnError = opts.onerror ?? null;
      fetchEventSourceCallCount++;
      return new Promise(() => {});
    }
  ),
}));

const mockRunSyncCycle = vi.fn().mockResolvedValue(undefined);
const mockIncomingFamily = {
  value: null as string | null,
};

const mockSetSseConnected = vi.fn();

vi.mock("~/composables/sync/useSyncClient", () => ({
  runSyncCycle: mockRunSyncCycle,
  setSseConnected: mockSetSseConnected,
  incomingFamily: mockIncomingFamily,
  isSyncing: { value: false },
  syncError: { value: null },
  pendingCount: { value: 0 },
  lastSyncAt: { value: null },
}));

vi.mock("~/lifecycle/management", () => ({
  buildLifecycleActorHeaders: vi.fn(() => ({ "x-actor-id": "actor_test" })),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn(() => ({ id: "actor_test" })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function sseResponse(status = 200, contentType = "text/event-stream") {
  return new Response(null, {
    status,
    headers: { "content-type": contentType },
  });
}

function resetCaptures() {
  capturedOnMessage = null;
  capturedOnOpen = null;
  capturedOnError = null;
  capturedSignal = null;
  fetchEventSourceCallCount = 0;
  fetchEventSourceUrl = "";
}

async function mountWithSse(gate?: BackoffGate) {
  const { useSseClient } = await import("~/composables/sync/useSseClient");
  return mount(
    defineComponent({
      setup() {
        useSseClient(gate ? { gate } : undefined);
        return {};
      },
      template: "<div/>",
    })
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useSseClient", () => {
  beforeEach(() => {
    resetCaptures();
    mockRunSyncCycle.mockClear();
    mockSetSseConnected.mockClear();
    mockIncomingFamily.value = null;
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Connection lifecycle ──────────────────────────────────────────────

  it("connects to /api/sse/events on mount", async () => {
    await mountWithSse();
    expect(fetchEventSourceCallCount).toBe(1);
    expect(fetchEventSourceUrl).toBe("/api/sse/events");
  });

  it("passes an AbortSignal to fetchEventSource", async () => {
    await mountWithSse();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("aborts the connection when the composable is unmounted", async () => {
    const wrapper = await mountWithSse();
    expect(capturedSignal?.aborted).toBe(false);
    wrapper.unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  // ── Message handling ──────────────────────────────────────────────────

  it("calls runSyncCycle when a valid SSE message arrives", async () => {
    await mountWithSse();
    capturedOnMessage!({
      data: JSON.stringify({
        cursor: "2026-01-01T12:00:00Z",
        family: "review",
      }),
    });
    await Promise.resolve();
    expect(mockRunSyncCycle).toHaveBeenCalledTimes(1);
  });

  it("sets incomingFamily before runSyncCycle and clears it after", async () => {
    let familyDuringCycle: typeof mockIncomingFamily.value = null;
    mockRunSyncCycle.mockImplementationOnce(async () => {
      familyDuringCycle = mockIncomingFamily.value;
    });

    await mountWithSse();
    capturedOnMessage!({
      data: JSON.stringify({
        cursor: "2026-01-01T12:00:00Z",
        family: "review",
      }),
    });

    await vi.waitFor(() => mockRunSyncCycle.mock.calls.length > 0);
    await Promise.resolve();

    expect(familyDuringCycle).toBe("review");
    expect(mockIncomingFamily.value).toBeNull();
  });

  it("clears incomingFamily even when runSyncCycle rejects", async () => {
    mockRunSyncCycle.mockRejectedValueOnce(new Error("network error"));
    await mountWithSse();
    capturedOnMessage!({
      data: JSON.stringify({
        cursor: "2026-01-01T12:00:00Z",
        family: "product",
      }),
    });
    expect(mockRunSyncCycle).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => mockIncomingFamily.value === null);
  });

  it("rings the doorbell (runSyncCycle) regardless of the family value", async () => {
    // The frame is a content-free doorbell — the data pull is cursor-driven, so
    // runSyncCycle must fire for any family, not just the page's own.
    let familyDuringCycle: string | null = null;
    mockRunSyncCycle.mockImplementationOnce(async () => {
      familyDuringCycle = mockIncomingFamily.value;
    });
    await mountWithSse();
    capturedOnMessage!({
      data: JSON.stringify({
        cursor: "2026-01-01T12:00:00Z",
        family: "product",
      }),
    });
    await vi.waitFor(() => mockRunSyncCycle.mock.calls.length > 0);
    await Promise.resolve();
    expect(mockRunSyncCycle).toHaveBeenCalledTimes(1);
    expect(familyDuringCycle).toBe("product");
    expect(mockIncomingFamily.value).toBeNull();
  });

  it("rings the doorbell but leaves family null for an old-shape frame missing family", async () => {
    // A valid-JSON frame without `family` (e.g. an older server) must still
    // trigger a sync cycle; only the cosmetic indicator stays dark.
    let familyDuringCycle: string | null = "unset";
    mockRunSyncCycle.mockImplementationOnce(async () => {
      familyDuringCycle = mockIncomingFamily.value;
    });
    await mountWithSse();
    capturedOnMessage!({
      data: JSON.stringify({ cursor: "2026-01-01T12:00:00Z" }),
    });
    await vi.waitFor(() => mockRunSyncCycle.mock.calls.length > 0);
    await Promise.resolve();
    expect(mockRunSyncCycle).toHaveBeenCalledTimes(1);
    expect(familyDuringCycle).toBeNull();
    expect(mockIncomingFamily.value).toBeNull();
  });

  it("does not clear the indicator when an older same-family cycle finishes before a newer one", async () => {
    // Two overlapping frames for the same family: the first cycle's finally must
    // not clear the indicator while the second cycle is still in flight.
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    mockRunSyncCycle
      .mockReturnValueOnce(
        new Promise<void>((r) => {
          resolveFirst = r;
        })
      )
      .mockReturnValueOnce(
        new Promise<void>((r) => {
          resolveSecond = r;
        })
      );

    await mountWithSse();
    const frame = {
      data: JSON.stringify({
        cursor: "2026-01-01T12:00:00Z",
        family: "review",
      }),
    };
    capturedOnMessage!(frame); // frame 1 → cycle 1 (pending)
    capturedOnMessage!(frame); // frame 2 → cycle 2 (pending)
    expect(mockRunSyncCycle).toHaveBeenCalledTimes(2);
    expect(mockIncomingFamily.value).toBe("review");

    // Older cycle finishes first — must NOT clear while cycle 2 is running.
    resolveFirst();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockIncomingFamily.value).toBe("review");

    // Newest cycle finishes — now the indicator clears.
    resolveSecond();
    await vi.waitFor(() => mockIncomingFamily.value === null);
  });

  it("ignores malformed SSE data without calling runSyncCycle", async () => {
    await mountWithSse();
    capturedOnMessage!({ data: "not-json{{{{" });
    await Promise.resolve();
    expect(mockRunSyncCycle).not.toHaveBeenCalled();
  });

  it("ignores empty SSE data", async () => {
    await mountWithSse();
    capturedOnMessage!({ data: "" });
    await Promise.resolve();
    expect(mockRunSyncCycle).not.toHaveBeenCalled();
  });

  // ── Poll suppression signals ────────────────────────────────────────────

  it("signals setSseConnected(true) on successful connection", async () => {
    await mountWithSse();
    await capturedOnOpen!(sseResponse());
    expect(mockSetSseConnected).toHaveBeenCalledWith(true);
  });

  it("rejects a non-SSE response without marking the connection healthy", async () => {
    await mountWithSse();

    await expect(
      capturedOnOpen!(sseResponse(502, "text/plain"))
    ).rejects.toThrow("SSE connection failed with status 502");
    expect(mockSetSseConnected).not.toHaveBeenCalledWith(true);
  });

  it("signals setSseConnected(false) on error", async () => {
    await mountWithSse(new BackoffGate());
    try {
      capturedOnError!();
    } catch {
      /* throws "abort" */
    }
    expect(mockSetSseConnected).toHaveBeenCalledWith(false);
  });

  it("signals setSseConnected(false) on unmount", async () => {
    const wrapper = await mountWithSse();
    wrapper.unmount();
    expect(mockSetSseConnected).toHaveBeenCalledWith(false);
  });

  // ── BackoffGate via DI ────────────────────────────────────────────────

  it("records gate success on connection open", async () => {
    const gate = new BackoffGate({ baseMs: 1000, capMs: 60_000 });
    await mountWithSse(gate);

    // Simulate a prior failure to verify onopen resets it
    gate.recordFailure();
    expect(gate.isHealthy).toBe(false);

    await capturedOnOpen!(sseResponse());

    expect(gate.isHealthy).toBe(true);
    expect(gate.consecutiveFailures).toBe(0);
  });

  it("records gate failure on error and aborts current connection", async () => {
    const gate = new BackoffGate({ baseMs: 1000, capMs: 60_000 });
    await mountWithSse(gate);

    const signal = capturedSignal!;
    expect(signal.aborted).toBe(false);

    try {
      capturedOnError!();
    } catch {
      /* throws "abort" */
    }

    expect(gate.consecutiveFailures).toBe(1);
    expect(gate.isHealthy).toBe(false);
    expect(signal.aborted).toBe(true);
  });

  it("onerror throws to stop fetchEventSource built-in retry", async () => {
    await mountWithSse(new BackoffGate());
    expect(() => capturedOnError!()).toThrow("abort");
  });

  it("does not connect when gate.mayAttempt() returns false", async () => {
    const gate = new BackoffGate({ baseMs: 1000, capMs: 60_000 });
    // Burn through failures so mayAttempt returns false
    gate.recordFailure();
    gate.recordFailure();
    gate.recordFailure();

    vi.useFakeTimers();
    await mountWithSse(gate);
    expect(fetchEventSourceCallCount).toBe(0);
    vi.useRealTimers();
  });

  it("schedules reconnect via gate.delay() after error", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1); // deterministic jitter
    const gate = new BackoffGate({ baseMs: 1000, capMs: 60_000 });

    await mountWithSse(gate);
    expect(fetchEventSourceCallCount).toBe(1);

    try {
      capturedOnError!();
    } catch {
      /* expected */
    }

    // After 1 failure: delay = 1000 * 2^1 * 1.0 = 2000ms
    vi.advanceTimersByTime(1999);
    expect(fetchEventSourceCallCount).toBe(1); // not yet
    vi.advanceTimersByTime(1);
    expect(fetchEventSourceCallCount).toBe(2); // reconnected
    vi.useRealTimers();
  });
});
