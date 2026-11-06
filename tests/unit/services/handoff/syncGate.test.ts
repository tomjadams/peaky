/**
 * Degraded-sync handoff gating (local-first/REQ-012; AC-019, AC-020).
 *
 * Local draft editing — selection, removal, rationale, reordering — never
 * depends on sync health. Association and replacement confirmation claim
 * shared uniqueness, so they are disabled with a stated reason whenever the
 * client cannot guarantee a current shared association view.
 */
import { describe, expect, it } from "vitest";
import {
  assertConfirmationAvailable,
  CONFIRMATION_UNAVAILABLE_REASON,
  handoffSyncGate,
} from "~/services/handoff/syncGate";

describe("handoffSyncGate (local-first/REQ-012)", () => {
  it.each(["online", "syncing"] as const)(
    "keeps every operation available while %s",
    (status) => {
      const gate = handoffSyncGate(status);
      expect(gate.draftEditing.available).toBe(true);
      expect(gate.confirmation.available).toBe(true);
      expect(gate.confirmation.reason).toBeNull();
    }
  );

  it.each(["degraded", "offline"] as const)(
    "keeps draft editing available while %s (AC-019)",
    (status) => {
      const gate = handoffSyncGate(status);
      // Selection, rationale editing, and ordering stay available locally.
      expect(gate.draftEditing.available).toBe(true);
      expect(gate.sharedViewCurrent).toBe(false);
    }
  );

  it.each(["degraded", "offline"] as const)(
    "disables confirmation with a stated reason while %s (AC-020)",
    (status) => {
      const gate = handoffSyncGate(status);
      expect(gate.confirmation.available).toBe(false);
      // The reason names why: duplicate prevention needs a current shared
      // association view, which degraded sync cannot guarantee.
      expect(gate.confirmation.reason).toBe(CONFIRMATION_UNAVAILABLE_REASON);
      expect(gate.confirmation.reason).toContain("duplicate prevention");
    }
  );

  it("assertConfirmationAvailable throws the stated reason when disabled", () => {
    const gate = handoffSyncGate("offline");
    expect(() => assertConfirmationAvailable(gate)).toThrowError(
      CONFIRMATION_UNAVAILABLE_REASON
    );
    expect(() =>
      assertConfirmationAvailable(handoffSyncGate("online"))
    ).not.toThrow();
  });
});
