/**
 * Inbound sync handlers for the handoff review children
 * (local-first/REQ-011; AC-018): pulled `review_handoff_practice` and
 * `review_handoff_association` events write into the group-5 SQLite tables
 * through the group-5 row codecs. Practice rows merge partial HLC field
 * events over the existing row; association transitions are append-only
 * inserts, so a replayed stable transition ID can never duplicate history
 * and the current association resolves on read as the latest non-revoked
 * transition (design Decision 3).
 */
import { beforeEach, expect, it, vi } from "vitest";

const replayMock = vi.fn().mockResolvedValue({ eventId: "replayed" });

vi.mock("~/services/local-mutation", () => ({
  localMutation: { replay: replayMock },
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-09-10T10:00:00.000Z"),
    createUuidV7: vi.fn(() => "uuid-test"),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    eq: vi.fn((column: unknown, value: unknown) => ({
      __eq: true,
      column,
      value,
    })),
  };
});

vi.mock("#shared/db/schema", () => ({
  reviewHandoffPractices: {
    _: { name: "review_handoff_practices" },
    id: "id",
  },
  reviewHandoffAssociations: {
    _: { name: "review_handoff_associations" },
    id: "id",
  },
  fieldVersions: {
    _: { name: "field_versions" },
    entityType: "entity_type",
    entityId: "entity_id",
    fieldName: "field_name",
  },
  fieldVersionEvents: {
    _: { name: "field_version_events" },
    eventId: "event_id",
    entityType: "entity_type",
    entityId: "entity_id",
    fieldName: "field_name",
    updatedAt: "updated_at",
    id: "id",
  },
}));

type CapturedInsert = {
  table: string;
  row: Record<string, unknown>;
  conflictSet?: Record<string, unknown>;
  didNothing?: boolean;
};

/** Existing rows returned by the select mock, keyed by table name. */
let existingRows: Record<string, Record<string, unknown>[]>;

function makeTx() {
  const inserts: CapturedInsert[] = [];
  const tx = {
    insert(table: { _: { name: string } }) {
      return {
        values(row: Record<string, unknown>) {
          const entry: CapturedInsert = { table: table._.name, row };
          inserts.push(entry);
          return {
            onConflictDoUpdate({ set }: { set: Record<string, unknown> }) {
              entry.conflictSet = set;
              return Promise.resolve();
            },
            onConflictDoNothing() {
              entry.didNothing = true;
              return Promise.resolve();
            },
          };
        },
      };
    },
    select() {
      return {
        from(table: { _: { name: string } }) {
          return {
            where() {
              const rows = existingRows[table._.name] ?? [];
              return {
                limit: () => Promise.resolve(rows),
                orderBy: () => ({ limit: () => Promise.resolve(rows) }),
              };
            },
          };
        },
      };
    },
  };
  return { tx, inserts };
}

/** Run the stateWrite captured inside the most recent replay() call. */
async function runStateWrite(callIndex = 0): Promise<CapturedInsert[]> {
  const { tx, inserts } = makeTx();
  const stateWrite = replayMock.mock.calls[callIndex]?.[0]?.stateWrite as
    | ((tx: unknown) => Promise<void>)
    | undefined;
  if (stateWrite) await stateWrite(tx);
  return inserts;
}

const PRACTICE_ID = "review_handoff_practice:review-1/rev-a/q-1/cl-1";

const snapshotValue = {
  title: "Verify TLS configuration",
  questionText: "Is TLS enforced?",
  pillarName: "Security",
  templateName: "ORR 2026",
  revisionNumber: 1,
  evidenceState: "unmet",
  leadingPractices: [],
  helpfulLinks: [{ title: "Guide", url: "https://example.com/g" }],
  evidenceIdentifiers: ["ev-1"],
};

function practiceEvent(
  overrides: Partial<{
    id: string;
    entityId: string;
    fields: { name: string; value: unknown; hlc: string }[];
    time: string;
  }> = {}
) {
  return {
    id: overrides.id ?? "evt-hp-1",
    entityType: "review_handoff_practice",
    entityId: overrides.entityId ?? PRACTICE_ID,
    operation: "upsert",
    actorId: "actor-1",
    fields: overrides.fields ?? [
      { name: "orderKey", value: JSON.stringify("a"), hlc: "h" },
      { name: "snapshot", value: JSON.stringify(snapshotValue), hlc: "h" },
      { name: "rationale", value: JSON.stringify("why"), hlc: "h" },
      {
        name: "selectionState",
        value: JSON.stringify("selected"),
        hlc: "h",
      },
      {
        name: "occurredAt",
        value: JSON.stringify("2026-09-01T09:00:00Z"),
        hlc: "h",
      },
    ],
    time: overrides.time ?? "2026-09-10T10:00:00.000Z",
  };
}

function associationEvent(
  id: string,
  action: string,
  fields: Record<string, unknown> = {}
) {
  const base: Record<string, unknown> = {
    practiceEntityId: PRACTICE_ID,
    action,
    priorTransitionId: null,
    occurredAt: "2026-09-10T10:00:00.000Z",
    ...(action === "revoke"
      ? { provider: null, externalId: null, url: null }
      : {
          provider: "gitlab",
          externalId: "TEAM-1",
          url: "https://example.com/t/1",
        }),
    ...fields,
  };
  return {
    id,
    entityType: "review_handoff_association",
    entityId: `review_handoff_association:review-1/${id}`,
    operation: "upsert",
    actorId: "actor-1",
    fields: Object.entries(base).map(([name, value]) => ({
      name,
      value: value === null ? null : JSON.stringify(value),
      hlc: "h",
    })),
    time: "2026-09-10T10:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  existingRows = {};
});

// ── review_handoff_practice ─────────────────────────────────

it("ReviewHandoffPracticeHandler upserts the practice row via the codec", async () => {
  const { ReviewHandoffPracticeHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffPracticeHandler");

  await ReviewHandoffPracticeHandler.handle(practiceEvent());

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ReviewHandoffPracticeSynced.v1",
    reviewId: "review-1",
  });
  const inserts = await runStateWrite();
  const row = inserts.find((i) => i.table === "review_handoff_practices")!;
  expect(row.row).toMatchObject({
    id: PRACTICE_ID,
    reviewId: "review-1",
    templateRevisionId: "rev-a", // opaque pass-through, never parsed
    questionId: "q-1",
    practiceId: "cl-1",
    orderKey: "a",
    rationale: "why",
    selectionState: "selected",
  });
  // The snapshot is stored as JSON text in the codec's shape.
  expect(JSON.parse(row.row.snapshot as string)).toMatchObject({
    title: "Verify TLS configuration",
    evidenceState: "unmet",
  });
  // Upsert: field-level HLC convergence on the deterministic entity ID.
  expect(row.conflictSet).toBeDefined();
});

it("ReviewHandoffPracticeHandler merges a partial field event over the existing row", async () => {
  const { ReviewHandoffPracticeHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffPracticeHandler");
  existingRows = {
    review_handoff_practices: [
      {
        id: PRACTICE_ID,
        reviewId: "review-1",
        templateRevisionId: "rev-a",
        questionId: "q-1",
        practiceId: "cl-1",
        orderKey: "a",
        snapshot: JSON.stringify(snapshotValue),
        rationale: "original",
        selectionState: "selected",
        actorId: "actor-0",
        occurredAt: "2026-09-01T09:00:00.000Z",
        updatedAt: "2026-09-09T10:00:00.000Z",
      },
    ],
  };

  // A reorder pushes only the order key (field-level HLC).
  await ReviewHandoffPracticeHandler.handle(
    practiceEvent({
      id: "evt-hp-reorder",
      fields: [{ name: "orderKey", value: JSON.stringify("b"), hlc: "h2" }],
    })
  );

  const inserts = await runStateWrite();
  const row = inserts.find((i) => i.table === "review_handoff_practices")!;
  expect(row.row.orderKey).toBe("b");
  // Untouched fields survive the partial event.
  expect(row.row.rationale).toBe("original");
  expect(row.row.selectionState).toBe("selected");
  expect(row.row.occurredAt).toBe("2026-09-01T09:00:00.000Z");
});

it("ReviewHandoffPracticeHandler skips malformed entity IDs and deletes", async () => {
  const { ReviewHandoffPracticeHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffPracticeHandler");

  await ReviewHandoffPracticeHandler.handle(
    practiceEvent({ entityId: "review_handoff_practice:review-1/rev-a" })
  );
  expect(replayMock).not.toHaveBeenCalled();

  // Deletes are not part of the domain — removal is a selectionState write.
  await ReviewHandoffPracticeHandler.handle({
    ...practiceEvent({ id: "evt-hp-del" }),
    operation: "delete",
  });
  expect(replayMock).not.toHaveBeenCalled();
});

it("ReviewHandoffPracticeHandler writes no row for an incomplete first write", async () => {
  const { ReviewHandoffPracticeHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffPracticeHandler");

  // No existing row and the event carries no snapshot: the in-transaction
  // guard finds nothing to merge into and inserts no practice row.
  await ReviewHandoffPracticeHandler.handle(
    practiceEvent({
      id: "evt-hp-partial",
      fields: [{ name: "orderKey", value: JSON.stringify("b"), hlc: "h" }],
    })
  );

  const inserts = await runStateWrite();
  expect(
    inserts.filter((i) => i.table === "review_handoff_practices")
  ).toHaveLength(0);
});

// ── review_handoff_association ──────────────────────────────

it("ReviewHandoffAssociationHandler inserts an append-only transition row", async () => {
  const { ReviewHandoffAssociationHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffAssociationHandler");

  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-1", "associate")
  );

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ReviewHandoffAssociationSynced.v1",
    reviewId: "review-1",
  });
  const inserts = await runStateWrite();
  const row = inserts.find((i) => i.table === "review_handoff_associations")!;
  expect(row.row).toMatchObject({
    id: "trn-1",
    reviewId: "review-1",
    practiceEntityId: PRACTICE_ID,
    action: "associate",
    provider: "gitlab",
    externalId: "TEAM-1",
    url: "https://example.com/t/1",
    priorTransitionId: null,
  });
  // Append-only with a stable transition ID: the insert ignores conflicts so
  // a replayed event can never duplicate history (AC-018).
  expect(row.didNothing).toBe(true);
  expect(row.conflictSet).toBeUndefined();
});

it("replayed association events resolve the current association on read, never a pointer", async () => {
  const { ReviewHandoffAssociationHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffAssociationHandler");
  const { associationTransitionFromRow } =
    await import("../../../../app/services/handoff/persistence");
  const { resolveCurrentAssociation } =
    await import("../../../../app/services/handoff/association");

  // associate → replace → revoke, then the associate replayed out of order.
  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-1", "associate", {
      occurredAt: "2026-09-01T09:00:00Z",
    })
  );
  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-2", "replace", {
      occurredAt: "2026-09-02T09:00:00Z",
      priorTransitionId: "trn-1",
      externalId: "TEAM-2",
    })
  );
  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-3", "revoke", {
      occurredAt: "2026-09-03T09:00:00Z",
      priorTransitionId: "trn-2",
    })
  );

  const rows: Record<string, unknown>[] = [];
  for (let call = 0; call < 3; call++) {
    const inserts = await runStateWrite(call);
    rows.push(
      inserts.find((i) => i.table === "review_handoff_associations")!.row
    );
  }
  const history = rows.map((row) => associationTransitionFromRow(row as never));
  // Latest transition is a revocation: no current association (AC-018,
  // design Decision 3). The earlier transitions stay immutable history.
  expect(resolveCurrentAssociation(history, PRACTICE_ID)).toBeNull();
  expect(history.map((t) => t.action)).toEqual([
    "associate",
    "replace",
    "revoke",
  ]);
  expect(history[1]!.reference?.externalId).toBe("TEAM-2");
});

it("ReviewHandoffAssociationHandler skips malformed transitions", async () => {
  const { ReviewHandoffAssociationHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandoffAssociationHandler");

  // Unknown action.
  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-bad-action", "close")
  );
  // Revoke carrying a reference violates the stored invariant.
  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-bad-revoke", "revoke", { provider: "gitlab" })
  );
  // Malformed practice entity ID.
  await ReviewHandoffAssociationHandler.handle(
    associationEvent("trn-bad-practice", "associate", {
      practiceEntityId: "not-a-practice-id",
    })
  );
  // Malformed entity ID (missing type prefix).
  const badId = associationEvent("trn-bad-id", "associate");
  badId.entityId = "trn-bad-id";
  await ReviewHandoffAssociationHandler.handle(badId);

  expect(replayMock).not.toHaveBeenCalled();
});

it("dispatchInboundEvent routes the handoff entity types", async () => {
  const { dispatchInboundEvent } =
    await import("../../../../app/services/sync/inbound/index");

  await dispatchInboundEvent(practiceEvent());
  await dispatchInboundEvent(associationEvent("trn-route", "associate"));

  expect(replayMock).toHaveBeenCalledTimes(2);
  const types = replayMock.mock.calls.map(
    (call) => (call[0] as { event: { type: string } }).event.type
  );
  expect(types).toEqual([
    "ReviewHandoffPracticeSynced.v1",
    "ReviewHandoffAssociationSynced.v1",
  ]);
});
