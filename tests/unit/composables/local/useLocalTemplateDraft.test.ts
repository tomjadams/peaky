import { beforeEach, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type * as LocalDb from "~/local-db";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
    firstOrNull: actual.firstOrNull,
  };
});

vi.mock("~/services/local-mutation", () => ({
  localMutation: {
    localOnly: vi.fn().mockResolvedValue(undefined),
    draft: vi.fn(),
  },
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn(() => ({
    id: "actor-editor",
    name: "Editor",
    roles: ["member"],
  })),
}));

let localOnly: ReturnType<typeof vi.fn>;
let draft: ReturnType<typeof vi.fn>;
let withDatabase: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  const localDbModule = await import("~/local-db");
  withDatabase = vi.mocked(localDbModule.withDatabase);
  const { localMutation } = await import("~/services/local-mutation");
  localOnly = vi.mocked(localMutation.localOnly);
  localOnly.mockReset().mockResolvedValue(undefined);
  draft = vi.mocked(localMutation.draft);
});

function mockDraftTransaction(
  found = true,
  templateStatus: "active" | "archived" = "active",
  updates: { table: string; values: Record<string, unknown> }[] = []
) {
  localOnly.mockImplementation(async ({ stateWrite }) => {
    const fakeTx = {
      select: () => ({
        from: (table: Parameters<typeof getTableName>[0]) => ({
          where: () => ({
            limit: () => {
              const tableName = getTableName(table);
              if (!found) return Promise.resolve([]);
              if (tableName === "template_revisions") {
                return Promise.resolve([
                  {
                    id: "revision-1",
                    templateId: "template-1",
                    name: "Original Name",
                    description: "Original description",
                    status: "draft",
                    revisionNumber: null,
                    revisionSummary: null,
                    createdByActorId: "actor-creator",
                    updatedByActorId: "actor-creator",
                    publishedByActorId: null,
                    createdAt: "2026-08-20T10:00:00.000Z",
                    updatedAt: "2026-08-20T10:00:00.000Z",
                    publishedAt: null,
                  },
                ]);
              }
              return Promise.resolve([
                {
                  id: "template-1",
                  name: "Original Name",
                  description: "Original description",
                  status: templateStatus,
                  ownerTeamId: "team-platform",
                  createdByActorId: "actor-creator",
                  updatedByActorId: "actor-creator",
                  createdAt: "2026-08-20T10:00:00.000Z",
                  updatedAt: "2026-08-20T10:00:00.000Z",
                },
              ]);
            },
          }),
        }),
      }),
      update: (table: Parameters<typeof getTableName>[0]) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updates.push({ table: getTableName(table), values });
          },
        }),
      }),
    };
    await stateWrite(fakeTx as never, {
      now: "2026-08-20T11:00:00.000Z",
    });
  });
}

it("create() atomically inserts a Template and its initial draft Revision", async () => {
  const inserts: { table: string; values: Record<string, unknown> }[] = [];
  localOnly.mockImplementation(async ({ stateWrite }) => {
    await stateWrite(
      {
        select: () => ({
          from: (table: Parameters<typeof getTableName>[0]) => ({
            where: () => ({
              limit: () =>
                getTableName(table) === "directory_groups"
                  ? Promise.resolve([
                      {
                        id: "team-platform",
                        displayName: "Platform Engineering",
                        updatedAt: "2025-01-01T00:00:00.000Z",
                        sourceVersion: "old-snapshot",
                      },
                    ])
                  : Promise.resolve([]),
            }),
          }),
        }),
        insert: (table: Parameters<typeof getTableName>[0]) => ({
          values: async (values: Record<string, unknown>) => {
            inserts.push({ table: getTableName(table), values });
          },
        }),
      } as never,
      { now: "2026-08-20T10:00:00.000Z" }
    );
  });
  const { createLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  const revisionId = await createLocalTemplateDraft({
    name: "My Template",
    description: "desc",
    ownerTeamId: "team-platform",
    actorId: "actor-creator",
    maturityDefinition: '{"schemaVersion":1,"thresholds":[25,40,60,80]}',
    pillars: [
      {
        id: "pillar-1",
        templateRevisionId: "",
        slug: "reliability",
        name: "Reliability",
        order: 1,
        questions: [
          {
            id: "question-1",
            order: 1,
            type: "yes-no",
            text: "Is it reliable?",
            riskLevel: "high",
            importance: "Prevents outages",
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
    ],
  });

  expect(revisionId).toBeTruthy();
  expect(revisionId).not.toBe(inserts[0]?.values.id);
  expect(inserts).toHaveLength(4);
  expect(inserts[0]).toMatchObject({
    table: "templates",
    values: {
      name: "My Template",
      description: "desc",
      status: "active",
      ownerTeamId: "team-platform",
      createdByActorId: "actor-creator",
      updatedByActorId: "actor-creator",
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:00:00.000Z",
    },
  });
  expect(inserts[1]).toMatchObject({
    table: "template_revisions",
    values: {
      id: revisionId,
      templateId: inserts[0]?.values.id,
      name: "My Template",
      description: "desc",
      status: "draft",
      revisionNumber: null,
      revisionSummary: null,
      createdByActorId: "actor-creator",
      updatedByActorId: "actor-creator",
      publishedByActorId: null,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T10:00:00.000Z",
      publishedAt: null,
      maturityDefinition: '{"schemaVersion":1,"thresholds":[25,40,60,80]}',
    },
  });
  expect(inserts[2]).toMatchObject({
    table: "template_pillars",
    values: {
      id: "pillar-1",
      templateRevisionId: revisionId,
      slug: "reliability",
      name: "Reliability",
    },
  });
  expect(inserts[3]).toMatchObject({
    table: "template_questions",
    values: {
      id: "question-1",
      pillarId: "pillar-1",
      text: "Is it reliable?",
      riskLevel: "high",
    },
  });
  expect(draft).not.toHaveBeenCalled();
});

it.each([
  ["no persisted snapshot", []],
  [
    "a selected ID absent from the snapshot",
    [{ id: "team-other", displayName: "Another Team" }],
  ],
])("create() rejects %s without partial rows", async (_label, groups) => {
  const inserts: { table: string; values: Record<string, unknown> }[] = [];
  localOnly.mockImplementation(async ({ stateWrite }) => {
    await stateWrite(
      {
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(groups) }),
          }),
        }),
        insert: (table: Parameters<typeof getTableName>[0]) => ({
          values: async (values: Record<string, unknown>) => {
            inserts.push({ table: getTableName(table), values });
          },
        }),
      } as never,
      { now: "2026-08-20T10:00:00.000Z" }
    );
  });
  const { createLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  await expect(
    createLocalTemplateDraft({
      name: "My Template",
      ownerTeamId: "team-platform",
      actorId: "actor-creator",
    })
  ).rejects.toThrow(/owner team/i);
  expect(inserts).toEqual([]);
  expect(localOnly).toHaveBeenCalledOnce();
  expect(draft).not.toHaveBeenCalled();
});

it.each([
  ["name", { name: "", ownerTeamId: "team-platform", actorId: "actor" }],
  ["owner Team", { name: "Template", ownerTeamId: "", actorId: "actor" }],
  ["actor", { name: "Template", ownerTeamId: "team-platform", actorId: "" }],
])("create() validates the %s", async (_label, input) => {
  const { createLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");
  await expect(createLocalTemplateDraft(input)).rejects.toThrow(/required/);
  expect(localOnly).not.toHaveBeenCalled();
});

it("update() advances Template and draft Revision updater provenance", async () => {
  const updates: { table: string; values: Record<string, unknown> }[] = [];
  mockDraftTransaction(true, "active", updates);
  const { updateLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  await updateLocalTemplateDraft("revision-1", { name: "New Name" });
  expect(updates).toEqual([
    {
      table: "templates",
      values: {
        name: "New Name",
        description: "Original description",
        updatedByActorId: "actor-editor",
        updatedAt: "2026-08-20T11:00:00.000Z",
      },
    },
    {
      table: "template_revisions",
      values: {
        name: "New Name",
        description: "Original description",
        updatedByActorId: "actor-editor",
        updatedAt: "2026-08-20T11:00:00.000Z",
      },
    },
  ]);
  expect(withDatabase).not.toHaveBeenCalled();
  expect(draft).not.toHaveBeenCalled();
});

it("update() rejects lifecycle changes before reads", async () => {
  const { updateLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  await expect(
    updateLocalTemplateDraft("revision-1", { status: "retired" })
  ).rejects.toMatchObject({ code: "template_write_unavailable" });
  expect(withDatabase).not.toHaveBeenCalled();
  expect(localOnly).not.toHaveBeenCalled();
});

it.each([
  ["published status", { status: "published" }],
  ["retired status", { status: "retired" }],
  ["Revision number", { revisionNumber: 2 }],
  ["publication timestamp", { publishedAt: "2026-08-20T10:00:00Z" }],
  ["publisher", { publishedByActorId: "actor-publisher" }],
])(
  "update() rejects %s transitions before reads",
  async (_name, transition) => {
    const { updateLocalTemplateDraft } =
      await import("~/composables/local/useLocalTemplateDraft");

    await expect(
      updateLocalTemplateDraft("revision-1", transition as never)
    ).rejects.toMatchObject({ code: "template_write_unavailable" });
    expect(withDatabase).not.toHaveBeenCalled();
    expect(localOnly).not.toHaveBeenCalled();
  }
);

it("update() rejects a missing draft", async () => {
  mockDraftTransaction(false);
  const { updateLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  await expect(
    updateLocalTemplateDraft("missing", { name: "New" })
  ).rejects.toThrow("Template draft not found");
  expect(localOnly).toHaveBeenCalledOnce();
  expect(withDatabase).not.toHaveBeenCalled();
});

it("update() rejects archived Template drafts", async () => {
  mockDraftTransaction(true, "archived");
  const { updateLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  await expect(
    updateLocalTemplateDraft("revision-1", { name: "New" })
  ).rejects.toThrow("Archived Template draft is immutable");
  expect(localOnly).toHaveBeenCalledOnce();
  expect(withDatabase).not.toHaveBeenCalled();
});

it("delete() fails closed before reads or writes", async () => {
  const { deleteLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");

  await expect(deleteLocalTemplateDraft("revision-1")).rejects.toMatchObject({
    code: "template_write_unavailable",
  });
  expect(withDatabase).not.toHaveBeenCalled();
  expect(localOnly).not.toHaveBeenCalled();
});

it("delete() validates the draft identity", async () => {
  const { deleteLocalTemplateDraft } =
    await import("~/composables/local/useLocalTemplateDraft");
  await expect(deleteLocalTemplateDraft("")).rejects.toThrow(
    "draftId is required"
  );
});
