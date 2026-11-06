import { getTableName, type SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("~/local-db", () => ({
  createUuidV7: vi.fn(() => "uuid-test"),
  generateOrderKey: vi.fn((n: number) => String(n).padStart(4, "0")),
}));

vi.mock("~/lifecycle/management", () => ({
  getDefaultLifecycleActor: vi.fn(() => ({
    id: "actor-editor",
    name: "Editor",
  })),
}));

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    localOnly: vi.fn().mockResolvedValue(undefined),
    draft: vi.fn(),
    draftBatch: vi.fn(),
  },
}));

let localOnly: ReturnType<typeof vi.fn>;
let draft: ReturnType<typeof vi.fn>;
let draftBatch: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const { localMutation } = await import("~/services/local-mutation");
  localOnly = vi.mocked(localMutation.localOnly);
  draft = vi.mocked(localMutation.draft);
  draftBatch = vi.mocked(localMutation.draftBatch);
});

it("addLocalQuestion() uses the state-only path", async () => {
  const { addLocalQuestion } =
    await import("~/composables/local/useLocalTemplateQuestions");

  await expect(
    addLocalQuestion("revision-1", "pillar-1", { text: "Question?" })
  ).resolves.toBe("uuid-test");
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("updateLocalQuestion() uses the state-only path", async () => {
  const { updateLocalQuestion } =
    await import("~/composables/local/useLocalTemplateQuestions");

  await updateLocalQuestion("question-1", { text: "Updated?" });
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("deleteLocalQuestion() uses the state-only path", async () => {
  const { deleteLocalQuestion } =
    await import("~/composables/local/useLocalTemplateQuestions");

  await deleteLocalQuestion("question-1");
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it("reorderLocalQuestions() uses one state-only transaction", async () => {
  const { reorderLocalQuestions } =
    await import("~/composables/local/useLocalTemplateQuestions");

  await reorderLocalQuestions("revision-1", "pillar-1", [
    "question-1",
    "question-2",
  ]);
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draftBatch).not.toHaveBeenCalled();
});

it("reorderLocalQuestions() scopes updates to the target Pillar", async () => {
  const updates: { table: string; where: SQL }[] = [];
  localOnly.mockImplementation(async ({ stateWrite }) => {
    const rows: Record<string, Record<string, unknown>[]> = {
      template_pillars: [{ id: "pillar-1", templateRevisionId: "revision-1" }],
      template_revisions: [
        {
          id: "revision-1",
          templateId: "template-1",
          status: "draft",
        },
      ],
      templates: [{ id: "template-1", status: "active" }],
    };
    await stateWrite(
      {
        select: () => ({
          from: (table: Parameters<typeof getTableName>[0]) => ({
            where: () => ({
              limit: () => Promise.resolve(rows[getTableName(table)] ?? []),
            }),
          }),
        }),
        update: (table: Parameters<typeof getTableName>[0]) => ({
          set: () => ({
            where: async (where: SQL) => {
              updates.push({ table: getTableName(table), where });
            },
          }),
        }),
      } as never,
      { now: "2026-08-20T10:00:00.000Z" }
    );
  });
  const { reorderLocalQuestions } =
    await import("~/composables/local/useLocalTemplateQuestions");

  await reorderLocalQuestions("revision-1", "pillar-1", ["question-1"]);

  const questionUpdate = updates.find(
    ({ table }) => table === "template_questions"
  );
  expect(questionUpdate).toBeDefined();
  const query = new SQLiteSyncDialect().sqlToQuery(questionUpdate!.where);
  expect(query.sql).toContain('"template_questions"."id" = ?');
  expect(query.sql).toContain('"template_questions"."pillar_id" = ?');
  expect(query.params).toEqual(["question-1", "pillar-1"]);
});

it("reorderLocalQuestions() rejects an empty Question identity before writing", async () => {
  const { reorderLocalQuestions } =
    await import("~/composables/local/useLocalTemplateQuestions");

  await expect(
    reorderLocalQuestions("revision-1", "pillar-1", ["question-1", ""])
  ).rejects.toThrow("questionIds contains an empty entry");
  expect(localOnly).not.toHaveBeenCalled();
});
