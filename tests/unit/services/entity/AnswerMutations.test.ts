import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { AnswerMutations } from "~/services/entity/AnswerMutations";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
  };
});

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn().mockReturnValue({
    id: "user-001",
    name: "Test User",
    roles: ["member"],
  }),
}));

const applyFieldVersionWrite = vi.hoisted(() => vi.fn());
const notifyLocalWrite = vi.hoisted(() => vi.fn());
vi.mock("~/services/sync/inbound/helpers", () => ({ applyFieldVersionWrite }));
vi.mock("~/services/sync/pushTrigger", () => ({ notifyLocalWrite }));

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    localOnly: vi.fn().mockResolvedValue(undefined),
    draft: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
    replay: vi.fn().mockResolvedValue({ eventId: "evt_test" }),
  },
}));

// HLC clock — returns incrementing values so tests can distinguish per-field
// stamping (each field gets a unique HLC) from atomic stamping (all share one).
const hlcState = vi.hoisted(() => ({ counter: 0 }));
vi.mock("~/services/sync/syncClock", () => ({
  getHLCClock: vi.fn().mockReturnValue({
    now: vi.fn(
      () => `1000:${String(++hlcState.counter).padStart(4, "0")}:user-001`
    ),
  }),
  resetHLCClock: vi.fn(),
}));

let answerMutations: AnswerMutations;
let localMutationDraft: ReturnType<typeof vi.fn>;
let localMutationLocalOnly: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  hlcState.counter = 0;
  answerMutations = new AnswerMutations();
  const { localMutation } = await import("~/services/local-mutation");
  localMutationDraft = vi.mocked(localMutation.draft);
  localMutationLocalOnly = vi.mocked(localMutation.localOnly);
});

it("save() throws if reviewId is missing", async () => {
  await expect(
    answerMutations.save({
      reviewId: "",
      templateRevisionId: "revision-1",
      questionId: "q-1",
      answer: "yes",
    })
  ).rejects.toThrow("reviewId is required");
});

it("save() throws if questionId is missing", async () => {
  await expect(
    answerMutations.save({
      reviewId: "review-1",
      templateRevisionId: "revision-1",
      questionId: "",
      answer: "yes",
    })
  ).rejects.toThrow("questionId is required");
});

it("save() rejects a Revision that is not selected by the Review", async () => {
  localMutationDraft.mockImplementationOnce(async ({ stateWrite }) => {
    const rows: unknown[] = [];
    const whereResult = Object.assign(Promise.resolve(rows), {
      limit: () => Promise.resolve(rows),
    });
    await stateWrite(
      {
        select: () => ({
          from: () => ({ where: () => whereResult }),
        }),
      },
      { now: "2026-03-26T10:00:00.000Z", outboxId: "outbox-1" }
    );
  });

  await expect(
    answerMutations.save({
      reviewId: "review-1",
      templateRevisionId: "revision-unselected",
      questionId: "q-1",
      answer: "yes",
    })
  ).rejects.toThrow("Template Revision is not selected");
});

it("save() calls localMutation.draft() (auto-save path, no audit event)", async () => {
  await answerMutations.save({
    reviewId: "review-1",
    templateRevisionId: "revision-1",
    questionId: "q-1",
    answer: "yes",
  });

  expect(localMutationDraft).toHaveBeenCalledOnce();
});

it("save() outbox entry has entityType review_answer and operation upsert", async () => {
  await answerMutations.save({
    reviewId: "review-1",
    templateRevisionId: "revision-1",
    questionId: "q-1",
    answer: "no",
  });

  const { outbox } = localMutationDraft.mock.calls[0]![0];
  expect(outbox.entityType).toBe("review_answer");
  expect(outbox.operation).toBe("upsert");
});

it("save() handles null answer (N/A case) without throwing", async () => {
  await expect(
    answerMutations.save({
      reviewId: "review-1",
      templateRevisionId: "revision-1",
      questionId: "q-1",
      answer: null,
    })
  ).resolves.toBeUndefined();

  expect(localMutationDraft).toHaveBeenCalledOnce();
});

it("save() stamps each field with an HLC in outbox.fields", async () => {
  const naReason = { reason: "not-in-scope" as const };
  const itemNaReasons = { "item-1": { reason: "other" as const } };

  await answerMutations.save({
    reviewId: "review-1",
    templateRevisionId: "revision-1",
    questionId: "q-1",
    answer: "na",
    naReason,
    itemNaReasons,
  });

  const { outbox } = localMutationDraft.mock.calls[0]![0];
  expect(outbox.fields).toHaveLength(3);
  const byName = Object.fromEntries(
    outbox.fields.map((f: { name: string }) => [f.name, f])
  );
  expect(byName["answer"]).toBeDefined();
  expect(byName["naReason"]).toBeDefined();
  expect(byName["itemNaReasons"]).toBeDefined();
  // Each field should have a unique HLC (per-field stamping, not atomic)
  const hlcs = outbox.fields.map((f: { hlc: string }) => f.hlc);
  expect(new Set(hlcs).size).toBe(hlcs.length);
});

it("records local history after a remote-only answer save", async () => {
  localMutationLocalOnly.mockImplementationOnce(async ({ stateWrite }) => {
    await stateWrite({} as never, { now: "2026-03-26T10:00:00.000Z" });
  });

  await answerMutations.recordRemoteHistory({
    reviewId: "review-1",
    questionId: "q-1",
    answer: "yes",
  });

  expect(applyFieldVersionWrite).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      entityType: "review_answer",
      entityId: "review-1:q-1",
      fieldName: "answer",
      value: '"yes"',
      actorId: "user-001",
    })
  );
  expect(notifyLocalWrite).toHaveBeenCalledOnce();
});

it("preserves an explicit empty checklist through sync and history serialization", async () => {
  const answer = { checked: [], na: [] };
  await answerMutations.save({
    reviewId: "review-1",
    templateRevisionId: "revision-1",
    questionId: "q-1",
    answer,
  });

  const answerField = localMutationDraft.mock.calls[0]![0].outbox.fields.find(
    (field: { name: string }) => field.name === "answer"
  );
  expect(answerField.value).toEqual(answer);

  localMutationLocalOnly.mockImplementationOnce(async ({ stateWrite }) => {
    await stateWrite({} as never, { now: "2026-03-26T10:00:00.000Z" });
  });
  await answerMutations.recordRemoteHistory({
    reviewId: "review-1",
    questionId: "q-1",
    answer,
  });

  expect(applyFieldVersionWrite).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ value: '{"checked":[],"na":[]}' })
  );
});
