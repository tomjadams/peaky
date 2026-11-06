/**
 * Client-side Advisor override write path (maturity-score/REQ-016;
 * AC-030, AC-031, AC-043; local-first/REQ-011).
 *
 * Group 6 delivered inbound handling and server push acceptance for
 * `review_maturity_override`; this service is the missing outbound half:
 * validate the transition against the local stream, insert the append-only
 * row, and enqueue the typed outbox entry in one atomic draft mutation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import {
  OverrideTransitionError,
  type OverrideTransition,
} from "~/services/maturity/override";
import { recordMaturityOverride } from "~/services/maturity/overrideWrite";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    createUuidV7: vi.fn(() => "01932b3c-7d00-7000-8000-0000000000ff"),
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
  };
});

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    draft: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
    replay: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
  },
}));

vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: vi
    .fn()
    .mockReturnValue({ now: vi.fn().mockReturnValue("1000:0001:advisor-1") }),
  resetHLCClock: vi.fn(),
}));

const createTransition: OverrideTransition = {
  id: "ovr-new",
  reviewId: "review-1",
  templateRevisionId: "rev-1",
  action: "create",
  actorId: "advisor-1",
  occurredAt: "2026-03-26T10:00:00.000Z",
  priorTransitionId: null,
  reviewedResult: { percent: 75, stage: 4 },
  explanation: "Evidence verified on site.",
  evidence: ["EV-100"],
};

let draft: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { localMutation } = await import("~/services/local-mutation");
  draft = vi.mocked(localMutation.draft);
});

describe("recordMaturityOverride", () => {
  it("enqueues a typed review_maturity_override outbox entry with every field (AC-030)", async () => {
    await recordMaturityOverride({
      history: [],
      transition: createTransition,
    });

    expect(draft).toHaveBeenCalledOnce();
    const { outbox } = draft.mock.calls[0]![0] as {
      outbox: {
        entityType: string;
        entityId: string;
        operation: string;
        fields: { name: string; value: unknown; hlc: string }[];
      };
    };
    expect(outbox.entityType).toBe("review_maturity_override");
    // Typed review-child identity: "<type>:<review>/<transition>" (group 6).
    expect(outbox.entityId).toBe("review_maturity_override:review-1/ovr-new");
    expect(outbox.operation).toBe("upsert");

    const fields = Object.fromEntries(
      outbox.fields.map((field) => [field.name, field.value])
    );
    // occurredAt is mandatory: the inbound handler skips any transition
    // without it (merge-check regression guard).
    expect(fields).toEqual({
      action: "create",
      templateRevisionId: "rev-1",
      reviewedPercent: 75,
      reviewedStage: 4,
      explanation: "Evidence verified on site.",
      evidence: ["EV-100"],
      priorTransitionId: null,
      occurredAt: "2026-03-26T10:00:00.000Z",
    });
    for (const field of outbox.fields) {
      expect(field.hlc).toMatch(/^\d+:\d{4}:.+$/);
    }
  });

  it("inserts the append-only row through the draft state write", async () => {
    await recordMaturityOverride({
      history: [],
      transition: createTransition,
    });

    const { stateWrite } = draft.mock.calls[0]![0] as {
      stateWrite: (tx: unknown) => Promise<void>;
    };
    const values = vi.fn();
    const tx = { insert: vi.fn(() => ({ values })) };
    await stateWrite(tx);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ovr-new",
        reviewId: "review-1",
        templateRevisionId: "rev-1",
        action: "create",
        reviewedPercent: 75,
        reviewedStage: 4,
        explanation: "Evidence verified on site.",
        evidence: JSON.stringify(["EV-100"]),
        priorTransitionId: null,
        actorId: "advisor-1",
      })
    );
  });

  it("rejects an invalid transition before any write (AC-043)", async () => {
    const existing: OverrideTransition = { ...createTransition, id: "ovr-1" };
    await expect(
      recordMaturityOverride({
        history: [existing],
        // A second create while a current override exists is invalid.
        transition: createTransition,
      })
    ).rejects.toThrow(OverrideTransitionError);
    expect(draft).not.toHaveBeenCalled();
  });

  it("accepts a revoke transition without a reviewed result (AC-031)", async () => {
    const existing: OverrideTransition = { ...createTransition, id: "ovr-1" };
    const revoke: OverrideTransition = {
      ...createTransition,
      id: "ovr-2",
      action: "revoke",
      priorTransitionId: "ovr-1",
      reviewedResult: null,
      evidence: [],
    };

    await recordMaturityOverride({ history: [existing], transition: revoke });

    expect(draft).toHaveBeenCalledOnce();
    const { outbox } = draft.mock.calls[0]![0] as {
      outbox: { fields: { name: string; value: unknown }[] };
    };
    const fields = Object.fromEntries(
      outbox.fields.map((field) => [field.name, field.value])
    );
    expect(fields.action).toBe("revoke");
    expect(fields.reviewedPercent).toBeNull();
    expect(fields.reviewedStage).toBeNull();
    expect(fields.priorTransitionId).toBe("ovr-1");
  });
});
