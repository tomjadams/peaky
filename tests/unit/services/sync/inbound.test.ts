/** Tests for inbound event handlers (Strategy pattern). */
import { beforeEach, expect, it, vi } from "vitest";

// ── shared mock for localMutation.replay ──

const replayMock = vi.fn().mockResolvedValue({ eventId: "replayed" });

vi.mock("~/services/local-mutation", () => ({
  localMutation: { replay: replayMock },
}));

// ── nowISO and createUuidV7 ──

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
    createUuidV7: vi.fn(() => "uuid-test"),
  };
});

// Mock `and` and `eq` from drizzle-orm to tag conditions for test inspection.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: vi.fn((...conditions: unknown[]) => ({ __isAnd: true, conditions })),
    eq: vi.fn((column: unknown, value: unknown) => ({
      __eq: true,
      column,
      value,
    })),
  };
});

// ── Drizzle table stubs ──

vi.mock("#shared/db/schema", () => ({
  reviewAnswerState: { _: { name: "review_answer_state" }, id: "id" },
  reviewNoteState: { _: { name: "review_note_state" }, id: "id" },
  reviewAttachments: { _: { name: "review_attachments" }, id: "id" },
  reviews: { _: { name: "reviews" }, id: "id" },
  reviewTemplateSelections: {
    _: { name: "review_template_selections" },
    reviewId: "review_id",
  },
  subjects: { _: { name: "subjects" }, id: "id", type: "type" },
  productProfiles: {
    _: { name: "product_profiles" },
    id: "id",
    subjectId: "subject_id",
  },
  teamProfiles: {
    _: { name: "team_profiles" },
    id: "id",
    subjectId: "subject_id",
  },
  fieldVersions: {
    _: { name: "field_versions" },
    id: "id",
    entityType: "entity_type",
    entityId: "entity_id",
    fieldName: "field_name",
    value: "value",
    hlc: "hlc",
    actorId: "actor_id",
    updatedAt: "updated_at",
  },
  fieldVersionEvents: {
    _: { name: "field_version_events" },
    id: "id",
    eventId: "event_id",
    entityType: "entity_type",
    entityId: "entity_id",
    fieldName: "field_name",
    value: "value",
    previousValue: "previous_value",
    hlc: "hlc",
    actorId: "actor_id",
    updatedAt: "updated_at",
  },
}));

type CapturedCall = {
  table: unknown;
  row: unknown;
  conflictSet?: unknown;
  conflictWhere?: unknown;
  onConflictDoNothing?: boolean;
};

type DeleteCall = { table: unknown; where: unknown };

/** Find the first captured call (insert or delete) matching a table name. */
function findByTable<T extends { table: unknown }>(
  arr: T[],
  name: string
): T | undefined {
  return arr.find(
    (c) => (c.table as { _: { name: string } })?._?.name === name
  );
}

/** Builds a spy tx that captures insert/delete calls. `subjectsType` controls
 *  what the select() mock returns for subjects-table queries. */
function makeCaptureTx(
  subjectsType = "product",
  profileRows: Record<string, unknown>[] = []
): {
  tx: unknown;
  calls: CapturedCall[];
  deleteCalls: DeleteCall[];
} {
  const calls: CapturedCall[] = [];
  const deleteCalls: DeleteCall[] = [];
  const tx = {
    insert(table: unknown) {
      return {
        values(row: unknown) {
          // Capture immediately — covers bare insert().values() (no
          // conflict clause) used by profile reinsert. Conflict methods
          // below enrich the same entry instead of pushing a new one.
          const entry: CapturedCall = { table, row };
          calls.push(entry);
          return {
            onConflictDoUpdate({
              set,
              where,
            }: {
              set: unknown;
              where?: unknown;
            }) {
              entry.conflictSet = set;
              entry.conflictWhere = where;
              return Promise.resolve();
            },
            onConflictDoNothing() {
              entry.onConflictDoNothing = true;
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where(where: unknown) {
          deleteCalls.push({ table, where });
          return Promise.resolve();
        },
      };
    },
    // select() mock — returns a typed row for subjects, profileRows for
    // profile tables, empty for other tables
    select() {
      return {
        from(table: unknown) {
          const tableName = (table as { _: { name: string } })?._?.name;
          return {
            where() {
              const result =
                tableName === "subjects"
                  ? [{ type: subjectsType }]
                  : tableName === "team_profiles" ||
                      tableName === "product_profiles"
                    ? profileRows
                    : [];
              return {
                orderBy() {
                  return {
                    limit() {
                      return Promise.resolve(result);
                    },
                  };
                },
                limit() {
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
  };
  return { tx, calls, deleteCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/** Run the stateWrite captured inside replay(). `subjectsType` controls the
 *  select mock's subjects row type (default "product"). `profileRows`
 *  controls what the mock returns for team_profiles/product_profiles
 *  selects (default empty). */
async function runStateWrite(
  subjectsType = "product",
  profileRows: Record<string, unknown>[] = []
): Promise<{
  calls: CapturedCall[];
  deleteCalls: DeleteCall[];
}> {
  const { tx, calls, deleteCalls } = makeCaptureTx(subjectsType, profileRows);
  const stateWrite = replayMock.mock.calls[0]?.[0]?.stateWrite as
    | ((tx: unknown) => Promise<void>)
    | undefined;
  if (stateWrite) await stateWrite(tx);
  return { calls, deleteCalls };
}

// ── ReviewAnswerHandler ──

it("ReviewAnswerHandler upserts review_answer_state with parsed fields", async () => {
  const { ReviewAnswerHandler } =
    await import("../../../../app/services/sync/inbound/ReviewAnswerHandler");

  await ReviewAnswerHandler.handle({
    id: "evt-1",
    entityType: "review_answer",
    entityId: "review-1:q-001",
    operation: "upsert",
    actorId: "user-1",
    fields: [
      { name: "answer", value: '"yes"', hlc: "1000:0001:user-1" },
      { name: "naReason", value: null, hlc: "1000:0001:user-1" },
    ],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  const { calls } = await runStateWrite();

  const answerInsert = calls[0]!;
  const row = answerInsert.row as Record<string, unknown>;
  expect(row.id).toBe("review-1:q-001");
  expect(row.reviewId).toBe("review-1");
  expect(row.questionId).toBe("q-001");
  // answer must be JSON.stringify'd to match AnswerMutations.save() storage format.
  expect(row.answer).toBe('"yes"');
  expect(row.naReason).toBeNull();
});

it("ReviewAnswerHandler skips events with malformed entityId", async () => {
  const { ReviewAnswerHandler } =
    await import("../../../../app/services/sync/inbound/ReviewAnswerHandler");

  await ReviewAnswerHandler.handle({
    id: "evt-2",
    entityType: "review_answer",
    entityId: "no-separator",
    operation: "upsert",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).not.toHaveBeenCalled();
});

// ── FieldVersionHandler ──

it("FieldVersionHandler records field history and current state", async () => {
  const { FieldVersionHandler } =
    await import("../../../../app/services/sync/inbound/FieldVersionHandler");

  await FieldVersionHandler.handle({
    id: "evt-3",
    entityType: "field_version",
    entityId: "review_answer:r-1:answer",
    operation: "upsert",
    actorId: "user-1",
    fields: [
      { name: "entityType", value: '"review_answer"', hlc: "1000:0001:user-1" },
      { name: "entityId", value: '"r-1:q-1"', hlc: "1000:0001:user-1" },
      { name: "fieldName", value: '"answer"', hlc: "1000:0001:user-1" },
      { name: "value", value: '"yes"', hlc: "1000:0001:user-1" },
      { name: "hlc", value: '"1000:0001:user-1"', hlc: "1000:0001:user-1" },
    ],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  const { calls } = await runStateWrite();
  const historyInsert = calls[0]!;
  const currentInsert = calls[1]!;
  const historyRow = historyInsert.row as Record<string, unknown>;
  const currentRow = currentInsert.row as Record<string, unknown>;
  expect(historyRow.entityType).toBe("review_answer");
  expect(historyRow.fieldName).toBe("answer");
  expect(historyRow.actorId).toBe("user-1");
  expect(historyRow.eventId).toBe("evt-3");
  expect(historyRow.previousValue).toBeNull();
  expect(currentRow.entityType).toBe("review_answer");
  expect(currentRow.fieldName).toBe("answer");
});

it("FieldVersionHandler ignores delete operations (append-only audit records)", async () => {
  const { FieldVersionHandler } =
    await import("../../../../app/services/sync/inbound/FieldVersionHandler");

  await FieldVersionHandler.handle({
    id: "evt-fv-del",
    entityType: "field_version",
    entityId: "review_answer:r-1:answer",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  // The explicit delete guard must prevent replay — field versions are
  // append-only. Removing the guard would let the empty-fields event
  // reach the row construction and call localMutation.replay.
  expect(replayMock).not.toHaveBeenCalled();
});

// ── ReviewNoteHandler ──

it.each([
  ["review", "review"],
  ["pillar", "pillar"],
  ["question", "question"],
])(
  "ReviewNoteHandler accepts valid scopeType '%s' from entity ID",
  async (inputScope, expectedScope) => {
    const { ReviewNoteHandler } =
      await import("../../../../app/services/sync/inbound/ReviewNoteHandler");

    await ReviewNoteHandler.handle({
      id: "evt-note-1",
      entityType: "review_note",
      entityId: `review-1:${inputScope}:pillar-1`,
      operation: "upsert",
      actorId: "user-1",
      fields: [
        { name: "content", value: '"test note"', hlc: "1000:0001:user-1" },
      ],
      time: "1000:0001:user-1",
    });

    expect(replayMock).toHaveBeenCalledOnce();
    const { calls } = await runStateWrite();
    const noteInsert = calls[0]!;
    const row = noteInsert.row as Record<string, unknown>;
    expect(row.scopeType).toBe(expectedScope);
    expect(row.reviewId).toBe("review-1");
    expect(row.scopeId).toBe("pillar-1");
  }
);

it("ReviewNoteHandler falls back scopeType to 'review' for invalid values in entity ID", async () => {
  const { ReviewNoteHandler } =
    await import("../../../../app/services/sync/inbound/ReviewNoteHandler");

  await ReviewNoteHandler.handle({
    id: "evt-note-2",
    entityType: "review_note",
    entityId: "review-1:invalid:pillar-1",
    operation: "upsert",
    actorId: "user-1",
    fields: [
      { name: "content", value: '"test note"', hlc: "1000:0001:user-1" },
    ],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  const { calls } = await runStateWrite();
  const noteInsert = calls[0]!;
  const row = noteInsert.row as Record<string, unknown>;
  expect(row.scopeType).toBe("review");
});

it("ReviewNoteHandler skips events with malformed entity ID (no colons)", async () => {
  const { ReviewNoteHandler } =
    await import("../../../../app/services/sync/inbound/ReviewNoteHandler");

  await ReviewNoteHandler.handle({
    id: "evt-note-3",
    entityType: "review_note",
    entityId: "bare-uuid-no-colons",
    operation: "upsert",
    actorId: "user-1",
    fields: [
      { name: "content", value: '"test note"', hlc: "1000:0001:user-1" },
    ],
    time: "1000:0001:user-1",
  });

  expect(replayMock).not.toHaveBeenCalled();
});

// ── Delete operation handling ──

it("ProductHandler deletes subjects and productProfiles on delete operation", async () => {
  const { ProductHandler } =
    await import("../../../../app/services/sync/inbound/ProductHandler");

  await ProductHandler.handle({
    id: "evt-del-1",
    entityType: "product",
    entityId: "prod-1",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ProductDeletedSynced.v1",
    entityId: "prod-1",
  });
  const { deleteCalls } = await runStateWrite();
  expect(deleteCalls).toHaveLength(2);
  const tables = deleteCalls.map(
    (c) => (c.table as { _: { name: string } })._.name
  );
  expect(tables).toContain("product_profiles");
  expect(tables).toContain("subjects");
  // Subjects delete must carry a compound type guard:
  // and(eq(id), eq(type, "product")) — not a bare eq(id).
  const subjectsDelete = findByTable(deleteCalls, "subjects")!;
  expect(subjectsDelete.where).toHaveProperty("__isAnd", true);
  const conditions = (
    subjectsDelete.where as {
      conditions: { __eq: boolean; value: unknown }[];
    }
  ).conditions;
  expect(conditions).toHaveLength(2);
  // Verify the actual predicate values, not just that `and` was used.
  expect(conditions.find((c) => c.value === "product")).toBeDefined();
  expect(conditions.find((c) => c.value === "prod-1")).toBeDefined();
  // The productProfiles delete uses a bare eq(subjectId), not a compound guard.
  const profileDelete = findByTable(deleteCalls, "product_profiles")!;
  expect(profileDelete.where).toHaveProperty("__eq", true);
  expect(profileDelete.where).not.toHaveProperty("__isAnd");
  expect((profileDelete.where as { value: unknown }).value).toBe("prod-1");
});

it("ReviewHandler does not replay Template Revision selections", async () => {
  const { ReviewHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandler");

  await ReviewHandler.handle({
    id: "evt-review-selection-gap",
    entityType: "review",
    entityId: "review-1",
    operation: "upsert",
    actorId: "user-1",
    fields: [
      { name: "subjectId", value: "team-1", hlc: "1000:0001:user-1" },
      {
        name: "templateRevisionIds",
        value: ["revision-a", "revision-b"],
        hlc: "1000:0002:user-1",
      },
    ],
    time: "1000:0002:user-1",
  });

  const { calls } = await runStateWrite();
  expect(findByTable(calls, "reviews")?.row).not.toHaveProperty(
    "templateRevisionIds"
  );
  expect(findByTable(calls, "review_template_selections")).toBeUndefined();
});

it("ReviewHandler deletes review on delete operation", async () => {
  const { ReviewHandler } =
    await import("../../../../app/services/sync/inbound/ReviewHandler");

  await ReviewHandler.handle({
    id: "evt-del-2",
    entityType: "review",
    entityId: "review-1",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ReviewDeletedSynced.v1",
    entityId: "review-1",
  });
  const { deleteCalls } = await runStateWrite();
  expect(deleteCalls).toHaveLength(1);
  expect((deleteCalls[0]!.table as { _: { name: string } })._.name).toBe(
    "reviews"
  );
});

it("TeamHandler deletes subjects and teamProfiles on delete operation", async () => {
  const { TeamHandler } =
    await import("../../../../app/services/sync/inbound/TeamHandler");

  await TeamHandler.handle({
    id: "evt-del-3",
    entityType: "team",
    entityId: "team-1",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "TeamDeletedSynced.v1",
    entityId: "team-1",
  });
  const { deleteCalls } = await runStateWrite();
  expect(deleteCalls).toHaveLength(2);
  const tables = deleteCalls.map(
    (c) => (c.table as { _: { name: string } })._.name
  );
  expect(tables).toContain("team_profiles");
  expect(tables).toContain("subjects");
  // Subjects delete must carry a compound type guard:
  // and(eq(id), eq(type, "team")) — not a bare eq(id).
  const subjectsDelete = findByTable(deleteCalls, "subjects")!;
  expect(subjectsDelete.where).toHaveProperty("__isAnd", true);
  const conditions = (
    subjectsDelete.where as {
      conditions: { __eq: boolean; value: unknown }[];
    }
  ).conditions;
  expect(conditions).toHaveLength(2);
  // Verify the actual predicate values, not just that `and` was used.
  expect(conditions.find((c) => c.value === "team")).toBeDefined();
  expect(conditions.find((c) => c.value === "team-1")).toBeDefined();
  // The teamProfiles delete uses a bare eq(subjectId), not a compound guard.
  const profileDelete = findByTable(deleteCalls, "team_profiles")!;
  expect(profileDelete.where).toHaveProperty("__eq", true);
  expect(profileDelete.where).not.toHaveProperty("__isAnd");
  expect((profileDelete.where as { value: unknown }).value).toBe("team-1");
});

it("ReviewAnswerHandler deletes review_answer_state on delete operation", async () => {
  const { ReviewAnswerHandler } =
    await import("../../../../app/services/sync/inbound/ReviewAnswerHandler");

  await ReviewAnswerHandler.handle({
    id: "evt-del-4",
    entityType: "review_answer",
    entityId: "review-1:q-001",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ReviewAnswerDeletedSynced.v1",
    entityId: "review-1:q-001",
  });
  const { deleteCalls } = await runStateWrite();
  expect(deleteCalls).toHaveLength(1);
  expect((deleteCalls[0]!.table as { _: { name: string } })._.name).toBe(
    "review_answer_state"
  );
});

it("AttachmentHandler deletes review_attachments on delete operation", async () => {
  const { AttachmentHandler } =
    await import("../../../../app/services/sync/inbound/AttachmentHandler");

  await AttachmentHandler.handle({
    id: "evt-del-5",
    entityType: "review_attachment",
    entityId: "att-1",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "AttachmentDeletedSynced.v1",
    entityId: "att-1",
  });
  const { deleteCalls } = await runStateWrite();
  expect(deleteCalls).toHaveLength(1);
  expect((deleteCalls[0]!.table as { _: { name: string } })._.name).toBe(
    "review_attachments"
  );
});

it("ReviewNoteHandler deletes review_note_state on delete operation", async () => {
  const { ReviewNoteHandler } =
    await import("../../../../app/services/sync/inbound/ReviewNoteHandler");

  await ReviewNoteHandler.handle({
    id: "evt-del-6",
    entityType: "review_note",
    entityId: "review-1:review:review-1",
    operation: "delete",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  expect(replayMock.mock.calls[0]![0].event).toMatchObject({
    type: "ReviewNoteDeletedSynced.v1",
    entityId: "review-1:review:review-1",
  });
  const { deleteCalls } = await runStateWrite();
  expect(deleteCalls).toHaveLength(1);
  expect((deleteCalls[0]!.table as { _: { name: string } })._.name).toBe(
    "review_note_state"
  );
});

// ── Cross-entity upsert protection (profile type guard) ──

it("ProductHandler skips profile upsert when subjects row is not a product", async () => {
  const { ProductHandler } =
    await import("../../../../app/services/sync/inbound/ProductHandler");

  await ProductHandler.handle({
    id: "evt-xentity-1",
    entityType: "product",
    entityId: "team-subj-1",
    operation: "upsert",
    actorId: "user-1",
    fields: [
      { name: "name", value: '"Evil Product"', hlc: "1000:0001:user-1" },
    ],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  // Simulate a subjects row that belongs to a team.
  const { calls, deleteCalls } = await runStateWrite("team");

  // subjects upsert still happens (onConflictDoUpdate is a no-op for wrong type).
  const subjectsInsert = findByTable(calls, "subjects")!;
  expect(subjectsInsert).toBeDefined();
  // The subjects upsert must carry a type guard in its onConflictDoUpdate
  // where clause — removing it would let a product event overwrite a team row.
  expect(subjectsInsert.conflictWhere).toHaveProperty("__eq", true);
  expect((subjectsInsert.conflictWhere as { value: unknown }).value).toBe(
    "product"
  );
  // No product_profiles insert or delete should occur.
  expect(findByTable(calls, "product_profiles")).toBeUndefined();
  expect(findByTable(deleteCalls, "product_profiles")).toBeUndefined();
});

it("TeamHandler skips profile upsert when subjects row is not a team", async () => {
  const { TeamHandler } =
    await import("../../../../app/services/sync/inbound/TeamHandler");

  await TeamHandler.handle({
    id: "evt-xentity-2",
    entityType: "team",
    entityId: "prod-subj-1",
    operation: "upsert",
    actorId: "user-1",
    fields: [{ name: "name", value: '"Evil Team"', hlc: "1000:0001:user-1" }],
    time: "1000:0001:user-1",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  // Simulate a subjects row that belongs to a product.
  const { calls, deleteCalls } = await runStateWrite("product");

  const subjectsInsert = findByTable(calls, "subjects")!;
  expect(subjectsInsert).toBeDefined();
  // The subjects upsert must carry a type guard in its onConflictDoUpdate
  // where clause — removing it would let a team event overwrite a product row.
  expect(subjectsInsert.conflictWhere).toHaveProperty("__eq", true);
  expect((subjectsInsert.conflictWhere as { value: unknown }).value).toBe(
    "team"
  );
  // No team_profiles insert or delete should occur.
  expect(findByTable(calls, "team_profiles")).toBeUndefined();
  expect(findByTable(deleteCalls, "team_profiles")).toBeUndefined();
});

it("TeamHandler preserves existing profile createdBy and createdAt on reinsert", async () => {
  const { TeamHandler } =
    await import("../../../../app/services/sync/inbound/TeamHandler");

  await TeamHandler.handle({
    id: "evt-team-preserve",
    entityType: "team",
    entityId: "team-1",
    operation: "upsert",
    actorId: "user-2",
    fields: [{ name: "name", value: '"Team One"', hlc: "2000:0001:user-2" }],
    time: "2000:0001:user-2",
  });

  // Supply existing profile rows with createdBy/createdAt from the
  // original creator. The handler should SELECT these before delete+reinsert
  // and preserve them instead of using event.actorId / now fallbacks.
  const { calls, deleteCalls } = await runStateWrite("team", [
    { createdBy: "user-1", createdAt: "2020-01-01T00:00:00.000Z" },
  ]);

  // Profile delete happens first (delete+reinsert pattern)
  expect(findByTable(deleteCalls, "team_profiles")).toBeDefined();

  // The reinserted profile row must preserve the original authorship
  const profileInsert = findByTable(calls, "team_profiles")!;
  expect(profileInsert).toBeDefined();
  const row = profileInsert.row as Record<string, unknown>;
  expect(row.createdBy).toBe("user-1");
  expect(row.createdAt).toBe("2020-01-01T00:00:00.000Z");
});

// ── dispatchInboundEvent router ──

it("dispatchInboundEvent skips unknown entity types silently", async () => {
  const { dispatchInboundEvent } =
    await import("../../../../app/services/sync/inbound/index");

  await expect(
    dispatchInboundEvent({
      id: "evt-x",
      entityType: "unknown_type",
      entityId: "e-1",
      operation: "upsert",
      actorId: "user-1",
      fields: [],
      time: "1000:0001:user-1",
    })
  ).resolves.toBeUndefined();

  expect(replayMock).not.toHaveBeenCalled();
});

it("dispatchInboundEvent routes review_answer to ReviewAnswerHandler", async () => {
  const { dispatchInboundEvent } =
    await import("../../../../app/services/sync/inbound/index");

  await dispatchInboundEvent({
    id: "evt-route",
    entityType: "review_answer",
    entityId: "review-2:q-002",
    operation: "upsert",
    actorId: "user-2",
    fields: [{ name: "answer", value: '"no"', hlc: "2000:0001:user-2" }],
    time: "2000:0001:user-2",
  });

  expect(replayMock).toHaveBeenCalledOnce();
  const { event } = replayMock.mock.calls[0]![0] as { event: { type: string } };
  expect(event.type).toBe("ReviewAnswerSynced.v1");
});

it("dispatchInboundEvent skips events with unsupported operations", async () => {
  const { dispatchInboundEvent } =
    await import("../../../../app/services/sync/inbound/index");

  await dispatchInboundEvent({
    id: "evt-bad-op",
    entityType: "review",
    entityId: "review-1",
    operation: "archive",
    actorId: "user-1",
    fields: [],
    time: "1000:0001:user-1",
  });

  // Unsupported operations must not reach the handler — they are logged
  // and skipped so the pull cursor advances past the bad event.
  expect(replayMock).not.toHaveBeenCalled();
});
