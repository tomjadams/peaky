/**
 * Client-side handoff write path (improvement-plans/REQ-006 through
 * REQ-008, REQ-011; AC-023, AC-028 through AC-032, AC-039, AC-042;
 * local-first/REQ-011, REQ-012).
 *
 * Group 6 delivered inbound handling and server push acceptance for
 * `review_handoff_practice` and `review_handoff_association`; this service
 * is the missing outbound half, following the group-9 overrideWrite
 * pattern: pure domain validation, local SQLite write, and typed outbox
 * enqueue in one atomic draft mutation. Confirmation and replacement are
 * gated on sync health (design Decision 6); draft edits never are.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssociationTransitionError,
  type AssociationTransition,
  type ExternalWorkItemReference,
} from "~/services/handoff/association";
import {
  selectPractice,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import { HandoffLimitError } from "~/services/handoff/limits";
import { practiceEntityId } from "~/services/handoff/practice";
import type { SelectablePractice } from "~/services/handoff/projection";
import { handoffSyncGate } from "~/services/handoff/syncGate";
import {
  clearHandoffPractices,
  confirmHandoffAssociation,
  deselectHandoffPractice,
  reorderHandoffPractice,
  replaceHandoffAssociation,
  selectHandoffPractice,
  setHandoffPracticeRationale,
} from "~/services/handoff/handoffWrite";

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    draft: vi.fn().mockResolvedValue(undefined),
    draftBatch: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
    replay: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
  },
}));

vi.mock("~/services/handoff/localLifecycle", () => ({
  planLocalHandoffSelection: vi
    .fn()
    .mockImplementation(
      (input: {
        reviewId: string;
        practiceEntityId: string;
        createdAt: string;
        createdBy: string;
      }) =>
        Promise.resolve({
          handoff: {
            id: `review_handoff:${input.reviewId}/1`,
            reviewId: input.reviewId,
            sequence: 1,
            status: "active",
            createdAt: input.createdAt,
            createdBy: input.createdBy,
            completedAt: null,
            completionMode: null,
            completedBy: null,
            note: null,
            selectedPracticeIds: [],
            unresolvedCount: null,
          },
          isNew: true,
          practiceEntityId: input.practiceEntityId,
        })
    ),
  ensureLocalHandoffForSelection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: vi
    .fn()
    .mockReturnValue({ now: vi.fn().mockReturnValue("1000:0001:actor-1") }),
  resetHLCClock: vi.fn(),
}));

const NOW = "2026-09-10T10:00:00.000Z";
const ONLINE = handoffSyncGate("online");
const OFFLINE = handoffSyncGate("offline");

function makePractice(
  title: string,
  ids: { revision?: string; question: string; practice?: string } = {
    question: "q-1",
  }
): SelectablePractice {
  const reference = {
    reviewId: "review-1",
    templateRevisionId: ids.revision ?? "rev-a",
    questionId: ids.question,
    practiceId: ids.practice ?? ids.question,
  };
  return {
    reference,
    entityId: practiceEntityId(reference),
    title,
    questionText: `Question ${ids.question}`,
    pillarSlug: "security",
    pillarName: "Security",
    templateName: "Security Review",
    revisionNumber: 1,
    severity: "high",
    evidence: { state: "unmet", provenance: { kind: "yes-no", answer: "no" } },
    leadingPractices: [],
    helpfulLinks: [],
    deepLink: {
      name: "team-review-assessment",
      params: { teamId: "team-1", reviewId: "review-1" },
      query: { templateRevisionId: reference.templateRevisionId },
      hash: `#question-${ids.question}`,
    },
    currentAssociation: null,
  };
}

function selectedRows(titles: string[]): HandoffPracticeRecord[] {
  let rows: HandoffPracticeRecord[] = [];
  titles.forEach((title, index) => {
    rows = selectPractice({
      existing: rows,
      practice: makePractice(title, { question: `q-${index + 1}` }),
      localHandoffId: "review_handoff:review-1/1",
      actorId: "actor-1",
      occurredAt: NOW,
    });
  });
  return rows;
}

const REFERENCE: ExternalWorkItemReference = {
  provider: "GitLab",
  externalId: "GL-42",
  url: "https://gitlab.example.com/issues/42",
};

interface OutboxCall {
  outbox: {
    entityType: string;
    entityId: string;
    operation: string;
    fields: { name: string; value: unknown; hlc: string }[];
  };
  stateWrite: (tx: unknown) => Promise<void>;
}

interface BatchCall {
  outbox: OutboxCall["outbox"][];
  stateWrite: (tx: unknown) => Promise<void>;
}

function fieldMap(call: OutboxCall["outbox"]) {
  return Object.fromEntries(
    call.fields.map((field) => [field.name, field.value])
  );
}

/** Minimal tx double capturing upserted and inserted values. */
function makeTx() {
  const upserted: unknown[] = [];
  const inserted: unknown[] = [];
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((row: unknown) => {
        inserted.push(row);
        return {
          onConflictDoUpdate: vi.fn((opts: { set: unknown }) => {
            upserted.push(opts.set);
            return Promise.resolve();
          }),
          onConflictDoNothing: vi.fn(() => Promise.resolve()),
        };
      }),
    })),
  };
  return { tx, upserted, inserted };
}

let draft: ReturnType<typeof vi.fn>;
let draftBatch: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { localMutation } = await import("~/services/local-mutation");
  draft = vi.mocked(localMutation.draft);
  draftBatch = vi.mocked(localMutation.draftBatch);
});

describe("selectHandoffPractice (REQ-006; AC-015, AC-023)", () => {
  it("upserts the new row and enqueues its full field set", async () => {
    const practice = makePractice("Enable branch protection");
    const next = await selectHandoffPractice({
      existing: [],
      practice,
      rationale: "Blocks direct pushes.",
      actorId: "actor-1",
      occurredAt: NOW,
    });

    expect(next).toHaveLength(1);
    expect(draft).toHaveBeenCalledOnce();
    const call = draft.mock.calls[0]![0] as OutboxCall;
    expect(call.outbox.entityType).toBe("review_handoff_practice");
    expect(call.outbox.entityId).toBe(practice.entityId);
    expect(call.outbox.operation).toBe("upsert");

    const fields = fieldMap(call.outbox);
    expect(fields.orderKey).toBe("0001");
    expect(fields.selectionState).toBe("selected");
    expect(fields.rationale).toBe("Blocks direct pushes.");
    expect(fields.occurredAt).toBe(NOW);
    // The snapshot travels as a structured value (the server re-validates
    // its bounded collections), never as pre-serialized text.
    expect(fields.snapshot).toMatchObject({
      title: "Enable branch protection",
      evidenceState: "unmet",
    });
    for (const field of call.outbox.fields) {
      expect(field.hlc).toMatch(/^\d+:\d{4}:.+$/);
    }

    const { tx, upserted } = makeTx();
    await call.stateWrite(tx);
    expect(upserted[0]).toMatchObject({
      orderKey: "0001",
      selectionState: "selected",
    });
  });

  it("re-selects a removed row with only the selection-state field (AC-023)", async () => {
    const rows = selectedRows(["A"]);
    const removed = rows.map((row) =>
      Object.assign({}, row, { selectionState: "removed" as const })
    );

    const next = await selectHandoffPractice({
      existing: removed,
      practice: makePractice("A", { question: "q-1" }),
      actorId: "actor-1",
      occurredAt: NOW,
    });

    expect(next[0]!.selectionState).toBe("selected");
    const call = draft.mock.calls[0]![0] as OutboxCall;
    expect(fieldMap(call.outbox)).toEqual({ selectionState: "selected" });
  });

  it("writes nothing when the practice is already selected", async () => {
    const rows = selectedRows(["A"]);
    const next = await selectHandoffPractice({
      existing: rows,
      practice: makePractice("A", { question: "q-1" }),
      actorId: "actor-1",
      occurredAt: NOW,
    });
    expect(next[0]!.selectionState).toBe("selected");
    expect(draft).not.toHaveBeenCalled();
  });

  it("rejects over-limit input atomically before any write (AC-039)", async () => {
    await expect(
      selectHandoffPractice({
        existing: [],
        practice: makePractice("A"),
        rationale: "x".repeat(2001),
        actorId: "actor-1",
        occurredAt: NOW,
      })
    ).rejects.toThrow(HandoffLimitError);
    expect(draft).not.toHaveBeenCalled();
  });
});

describe("deselectHandoffPractice / setHandoffPracticeRationale (AC-023)", () => {
  it("marks the row removed without deleting it", async () => {
    const rows = selectedRows(["A", "B"]);
    const next = await deselectHandoffPractice({
      rows,
      entityId: rows[0]!.id,
      updatedAt: NOW,
    });

    expect(next[0]!.selectionState).toBe("removed");
    expect(next[1]!.selectionState).toBe("selected");
    const call = draft.mock.calls[0]![0] as OutboxCall;
    expect(call.outbox.entityId).toBe(rows[0]!.id);
    expect(fieldMap(call.outbox)).toEqual({ selectionState: "removed" });
  });

  it("clears every selected row in one batch", async () => {
    const rows = selectedRows(["A", "B", "C"]);
    const next = await clearHandoffPractices({ rows, updatedAt: NOW });

    expect(next.every((row) => row.selectionState === "removed")).toBe(true);
    expect(draftBatch).toHaveBeenCalledOnce();
    expect(draft).not.toHaveBeenCalled();
    const call = draftBatch.mock.calls[0]![0] as BatchCall;
    expect(call.outbox).toHaveLength(3);
    expect(call.outbox.map(fieldMap)).toEqual([
      { selectionState: "removed" },
      { selectionState: "removed" },
      { selectionState: "removed" },
    ]);
  });

  it("enqueues only the rationale field on edit", async () => {
    const rows = selectedRows(["A"]);
    const next = await setHandoffPracticeRationale({
      rows,
      entityId: rows[0]!.id,
      rationale: "Why this matters",
      updatedAt: NOW,
    });

    expect(next[0]!.rationale).toBe("Why this matters");
    const call = draft.mock.calls[0]![0] as OutboxCall;
    expect(fieldMap(call.outbox)).toEqual({ rationale: "Why this matters" });
  });

  it("rejects an over-limit rationale without truncation or writes (AC-039, AC-040)", async () => {
    const rows = selectedRows(["A"]);
    await expect(
      setHandoffPracticeRationale({
        rows,
        entityId: rows[0]!.id,
        rationale: "…".repeat(2001),
        updatedAt: NOW,
      })
    ).rejects.toThrow(HandoffLimitError);
    expect(draft).not.toHaveBeenCalled();
    expect(rows[0]!.rationale).toBeNull();
  });
});

describe("reorderHandoffPractice (AC-023, AC-024)", () => {
  it("batch-enqueues the order-key write of every moved row atomically", async () => {
    const rows = selectedRows(["A", "B", "C"]);
    const next = await reorderHandoffPractice({
      rows,
      entityId: rows[2]!.id,
      toIndex: 0,
      updatedAt: NOW,
    });

    // C moved to the front; A and B shifted — all three keys change. The
    // row array keeps its stable order; orderKey carries the position.
    expect(
      next
        .filter((row) => row.selectionState === "selected")
        .toSorted((a, b) => a.orderKey.localeCompare(b.orderKey))
        .map((row) => row.snapshot.title)
    ).toEqual(["C", "A", "B"]);

    expect(draftBatch).toHaveBeenCalledOnce();
    expect(draft).not.toHaveBeenCalled();
    const call = draftBatch.mock.calls[0]![0] as BatchCall;
    expect(call.outbox).toHaveLength(3);
    const moved = call.outbox.find((entry) => entry.entityId === rows[2]!.id);
    expect(moved).toMatchObject({
      entityType: "review_handoff_practice",
      operation: "upsert",
    });
    expect(fieldMap(moved!)).toEqual({ orderKey: "0001" });
  });

  it("writes nothing when the target position is unchanged", async () => {
    const rows = selectedRows(["A", "B"]);
    await reorderHandoffPractice({
      rows,
      entityId: rows[0]!.id,
      toIndex: 0,
      updatedAt: NOW,
    });
    expect(draftBatch).not.toHaveBeenCalled();
    expect(draft).not.toHaveBeenCalled();
  });
});

describe("confirmHandoffAssociation (REQ-007; AC-028, AC-030, AC-031)", () => {
  function confirmInput(rows: HandoffPracticeRecord[]) {
    let n = 0;
    return {
      practices: rows.map((row) => row.reference),
      history: [] as AssociationTransition[],
      reference: REFERENCE,
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: () => `trn-${++n}`,
      gate: ONLINE,
    };
  }

  it("appends one associate transition per selected practice in one batch (AC-028)", async () => {
    const rows = selectedRows(["A", "B"]);
    const result = await confirmHandoffAssociation(confirmInput(rows));

    expect(result.ok).toBe(true);
    expect(draftBatch).toHaveBeenCalledOnce();
    const call = draftBatch.mock.calls[0]![0] as BatchCall;
    expect(call.outbox).toHaveLength(2);
    const first = call.outbox[0]!;
    expect(first.entityType).toBe("review_handoff_association");
    expect(first.entityId).toBe("review_handoff_association:review-1/trn-1");
    expect(fieldMap(first)).toEqual({
      practiceEntityId: rows[0]!.id,
      action: "associate",
      priorTransitionId: null,
      provider: "GitLab",
      externalId: "GL-42",
      url: "https://gitlab.example.com/issues/42",
      occurredAt: NOW,
    });

    // Append-only rows insert and never update.
    const { tx, inserted } = makeTx();
    await call.stateWrite(tx);
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      id: "trn-1",
      action: "associate",
      provider: "GitLab",
    });
  });

  it("rejects a duplicate confirmation with every conflict and writes nothing (AC-031)", async () => {
    const rows = selectedRows(["A", "B"]);
    const first = await confirmHandoffAssociation(confirmInput(rows));
    if (!first.ok) throw new Error("first confirmation must succeed");
    draftBatch.mockClear();

    const history = [...first.transitions];
    const result = await confirmHandoffAssociation({
      ...confirmInput(rows),
      history,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe("duplicate_association");
    if (result.code !== "duplicate_association") throw new Error("narrow");
    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts[0]!.current).toEqual(REFERENCE);
    expect(draftBatch).not.toHaveBeenCalled();
  });

  it("throws the gate reason when sync is degraded — no write (AC-020)", async () => {
    const rows = selectedRows(["A"]);
    await expect(
      confirmHandoffAssociation({ ...confirmInput(rows), gate: OFFLINE })
    ).rejects.toThrow(/duplicate prevention is unavailable/);
    expect(draftBatch).not.toHaveBeenCalled();
  });
});

describe("replaceHandoffAssociation (REQ-008; AC-032)", () => {
  async function currentTransition(): Promise<AssociationTransition> {
    const rows = selectedRows(["A"]);
    const result = await confirmHandoffAssociation({
      practices: rows.map((row) => row.reference),
      history: [],
      reference: REFERENCE,
      actorId: "actor-1",
      occurredAt: NOW,
      transitionIdFor: () => "trn-1",
      gate: ONLINE,
    });
    if (!result.ok) throw new Error("setup confirmation must succeed");
    return result.transitions[0]!;
  }

  it("appends a replace transition pointing at the current one", async () => {
    const current = await currentTransition();
    draft.mockClear();
    const proposed: ExternalWorkItemReference = {
      provider: "YouTrack",
      externalId: "YT-7",
      url: "https://youtrack.example.com/issue/YT-7",
    };
    const transition: AssociationTransition = {
      id: "trn-2",
      reviewId: current.reviewId,
      practice: current.practice,
      action: "replace",
      reference: proposed,
      priorTransitionId: current.id,
      actorId: "actor-1",
      occurredAt: NOW,
    };

    const next = await replaceHandoffAssociation({
      history: [current],
      transition,
      gate: ONLINE,
    });

    expect(next).toHaveLength(2);
    expect(draft).toHaveBeenCalledOnce();
    const call = draft.mock.calls[0]![0] as OutboxCall;
    expect(call.outbox.entityType).toBe("review_handoff_association");
    expect(call.outbox.entityId).toBe(
      "review_handoff_association:review-1/trn-2"
    );
    expect(fieldMap(call.outbox)).toMatchObject({
      action: "replace",
      priorTransitionId: "trn-1",
      provider: "YouTrack",
      externalId: "YT-7",
    });
  });

  it("rejects a stale replacement before any write (AC-032)", async () => {
    const current = await currentTransition();
    draft.mockClear();
    const stale: AssociationTransition = {
      ...current,
      id: "trn-9",
      action: "replace",
      priorTransitionId: "trn-other",
    };
    await expect(
      replaceHandoffAssociation({
        history: [current],
        transition: stale,
        gate: ONLINE,
      })
    ).rejects.toThrow(AssociationTransitionError);
    expect(draft).not.toHaveBeenCalled();
  });

  it("throws the gate reason when sync is degraded (AC-020)", async () => {
    const current = await currentTransition();
    draft.mockClear();
    await expect(
      replaceHandoffAssociation({
        history: [current],
        transition: { ...current, id: "trn-2", action: "replace" },
        gate: OFFLINE,
      })
    ).rejects.toThrow(/duplicate prevention is unavailable/);
    expect(draft).not.toHaveBeenCalled();
  });
});
