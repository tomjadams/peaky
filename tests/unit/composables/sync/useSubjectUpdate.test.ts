/**
 * Unit tests for useSubjectUpdate composable (now family-scoped).
 *
 * Verifies that:
 * - isReceivingUpdate is true only when incomingFamily matches the given family
 * - a different family does not trigger the indicator
 * - undefined family never triggers the indicator
 * - the computed value is reactive to incomingFamily changes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockIncomingFamily = ref<string | null>(null);

vi.mock("~/composables/sync/useSyncClient", () => ({
  incomingFamily: mockIncomingFamily,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useSubjectUpdate", () => {
  beforeEach(() => {
    mockIncomingFamily.value = null;
    vi.resetModules();
  });

  it("is false when no SSE update is in flight", async () => {
    const { useSubjectUpdate } =
      await import("~/composables/sync/useSubjectUpdate");
    const { isReceivingUpdate } = useSubjectUpdate("review");
    expect(isReceivingUpdate.value).toBe(false);
  });

  it("is true when the incoming family matches", async () => {
    const { useSubjectUpdate } =
      await import("~/composables/sync/useSubjectUpdate");
    const { isReceivingUpdate } = useSubjectUpdate("review");

    mockIncomingFamily.value = "review";

    expect(isReceivingUpdate.value).toBe(true);
  });

  it("is false when the incoming family is different", async () => {
    const { useSubjectUpdate } =
      await import("~/composables/sync/useSubjectUpdate");
    const { isReceivingUpdate } = useSubjectUpdate("review");

    mockIncomingFamily.value = "product";

    expect(isReceivingUpdate.value).toBe(false);
  });

  it("is false when family is undefined", async () => {
    const { useSubjectUpdate } =
      await import("~/composables/sync/useSubjectUpdate");
    const { isReceivingUpdate } = useSubjectUpdate(undefined);

    mockIncomingFamily.value = "review";

    expect(isReceivingUpdate.value).toBe(false);
  });

  it("reacts when incomingFamily clears", async () => {
    const { useSubjectUpdate } =
      await import("~/composables/sync/useSubjectUpdate");
    const { isReceivingUpdate } = useSubjectUpdate("review");

    mockIncomingFamily.value = "review";
    expect(isReceivingUpdate.value).toBe(true);

    mockIncomingFamily.value = null;
    expect(isReceivingUpdate.value).toBe(false);
  });

  it("accepts a reactive ref as family", async () => {
    const { useSubjectUpdate } =
      await import("~/composables/sync/useSubjectUpdate");
    const family = ref("review");
    const { isReceivingUpdate } = useSubjectUpdate(family);

    mockIncomingFamily.value = "review";
    expect(isReceivingUpdate.value).toBe(true);

    family.value = "product";
    expect(isReceivingUpdate.value).toBe(false);
  });
});
