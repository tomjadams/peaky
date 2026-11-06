import { beforeEach, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TemplateRevisionDetail } from "~/models";

const localOnly = vi.fn().mockResolvedValue(undefined);

vi.mock("~/services/local-mutation", () => ({
  localMutation: { localOnly },
}));

vi.mock("~/local-db", () => ({
  generateOrderKey: vi.fn((n: number) => `key-${n}`),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn(() => ({
    id: "actor-editor",
    name: "Editor",
    roles: ["member"],
  })),
}));

vi.mock("~/services/template/TemplatePersistence", () => ({
  templatePersistence: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  localOnly.mockReset().mockResolvedValue(undefined);
});

const template: TemplateRevisionDetail = {
  id: "revision-1",
  templateId: "template-1",
  name: "Security Review",
  description: "A comprehensive security review template",
  status: "draft",
  revisionNumber: null,
  revisionSummary: null,
  createdByActorId: "actor-creator",
  updatedByActorId: "actor-creator",
  publishedByActorId: null,
  createdAt: "2026-08-20T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  publishedAt: null,
  pillars: [
    {
      id: "pillar-1",
      templateRevisionId: "revision-1",
      slug: "security",
      name: "Security",
      description: "Security controls",
      order: 1,
      questions: [
        {
          id: "question-1",
          order: 1,
          type: "yes-no",
          text: "Are controls documented?",
          riskLevel: "high",
          importance: "Prevents gaps",
          checklistItems: [],
          leadingPractices: [],
          helpfulLinks: [],
        },
      ],
    },
  ],
};

function installTransaction(
  aggregateDescription = "Previous description",
  structure: {
    pillars?: Record<string, unknown>[];
    questions?: Record<string, unknown>[];
  } = {}
) {
  const writes: { operation: string; table: string; values?: unknown }[] = [];
  const rowsByTable: Record<string, Record<string, unknown>[]> = {
    templates: [
      {
        id: "template-1",
        name: "Security Review",
        description: aggregateDescription,
        status: "active",
        ownerTeamId: "team-security",
        createdByActorId: "actor-creator",
        updatedByActorId: "actor-creator",
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      },
    ],
    template_revisions: [
      {
        ...template,
        pillars: undefined,
      },
    ],
    template_pillars: structure.pillars ?? [
      {
        id: "pillar-1",
        templateRevisionId: "revision-1",
        slug: "security",
        name: "Security",
        description: "Security controls",
        orderKey: "key-1",
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      },
    ],
    template_questions: structure.questions ?? [
      {
        id: "question-1",
        pillarId: "pillar-1",
        orderKey: "key-1",
        type: "yes-no",
        text: "Are controls documented?",
        riskLevel: "high",
        importance: "Prevents gaps",
        checklistItems: "[]",
        leadingPractices: "[]",
        helpfulLinks: "[]",
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      },
    ],
  };
  const fakeTx = {
    select: () => ({
      from: (table: Parameters<typeof getTableName>[0]) => ({
        where: () => {
          const rows = rowsByTable[getTableName(table)] ?? [];
          return Object.assign(Promise.resolve(rows), {
            limit: () => Promise.resolve(rows),
          });
        },
      }),
    }),
    update: (table: Parameters<typeof getTableName>[0]) => ({
      set: (values: unknown) => ({
        where: async () => {
          writes.push({
            operation: "update",
            table: getTableName(table),
            values,
          });
        },
      }),
    }),
    insert: (table: Parameters<typeof getTableName>[0]) => ({
      values: async (values: unknown) => {
        writes.push({
          operation: "insert",
          table: getTableName(table),
          values,
        });
      },
    }),
    delete: (table: Parameters<typeof getTableName>[0]) => ({
      where: async () => {
        writes.push({ operation: "delete", table: getTableName(table) });
      },
    }),
  };
  localOnly.mockImplementation(async ({ stateWrite }) => {
    await stateWrite(fakeTx as never, {
      now: "2026-08-20T11:00:00.000Z",
    });
  });
  return writes;
}

it("saveLocalTemplateDraft() keeps new Template creation unavailable", async () => {
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");

  await expect(saveLocalTemplateDraft(template, null)).rejects.toMatchObject({
    code: "template_write_unavailable",
  });
  expect(localOnly).not.toHaveBeenCalled();
});

it("preserves authored-unit identities and timestamps during a metadata save", async () => {
  const writes = installTransaction();
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");

  await expect(saveLocalTemplateDraft(template, "revision-1")).resolves.toBe(
    "revision-1"
  );

  expect(
    writes.filter(({ table }) =>
      ["template_pillars", "template_questions"].includes(table)
    )
  ).toEqual([]);
  expect(writes).toEqual([
    expect.objectContaining({ operation: "update", table: "templates" }),
    expect.objectContaining({
      operation: "update",
      table: "template_revisions",
    }),
  ]);
});

it("updates one changed Question without rewriting aggregate or Pillar provenance", async () => {
  const writes = installTransaction(template.description);
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");
  const changed = structuredClone(template);
  changed.pillars[0]!.questions[0]!.text = "Are all controls documented?";

  await saveLocalTemplateDraft(changed, "revision-1");

  expect(
    writes.filter(({ table }) =>
      ["templates", "template_pillars"].includes(table)
    )
  ).toEqual([]);
  expect(writes.filter(({ table }) => table === "template_questions")).toEqual([
    expect.objectContaining({
      operation: "update",
      table: "template_questions",
      values: expect.objectContaining({ text: "Are all controls documented?" }),
    }),
  ]);
});

it("commits the maturity definition in the same atomic local write as template content (AC-063)", async () => {
  const writes = installTransaction();
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");
  const withMaturity: TemplateRevisionDetail = {
    ...template,
    maturityDefinition: '{"schemaVersion":1,"thresholds":[20,40,60,80]}',
  };

  await saveLocalTemplateDraft(withMaturity, "revision-1");

  const revisionUpdates = writes.filter(
    ({ operation, table }) =>
      operation === "update" && table === "template_revisions"
  );
  expect(revisionUpdates).toEqual([
    expect.objectContaining({
      values: expect.objectContaining({
        maturityDefinition: '{"schemaVersion":1,"thresholds":[20,40,60,80]}',
      }),
    }),
  ]);
});

it("leaves the maturity definition column untouched when the detail omits it", async () => {
  const writes = installTransaction();
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");

  await saveLocalTemplateDraft(template, "revision-1");

  const [revisionUpdate] = writes.filter(
    ({ operation, table }) =>
      operation === "update" && table === "template_revisions"
  );
  expect(revisionUpdate?.values).not.toHaveProperty("maturityDefinition");
});

it("writes the explicit no-definition state when the detail clears maturity (AC-060)", async () => {
  const writes = installTransaction();
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");
  const cleared: TemplateRevisionDetail = {
    ...template,
    maturityDefinition: null,
  };

  await saveLocalTemplateDraft(cleared, "revision-1");

  const [revisionUpdate] = writes.filter(
    ({ operation, table }) =>
      operation === "update" && table === "template_revisions"
  );
  expect(revisionUpdate?.values).toMatchObject({ maturityDefinition: null });
});

it("moves an existing Question before deleting its former Pillar", async () => {
  const writes = installTransaction(template.description, {
    pillars: [
      {
        id: "pillar-removed",
        templateRevisionId: "revision-1",
        slug: "legacy",
        name: "Legacy",
        description: "Removed controls",
        orderKey: "key-2",
      },
      {
        id: "pillar-1",
        templateRevisionId: "revision-1",
        slug: "security",
        name: "Security",
        description: "Security controls",
        orderKey: "key-1",
      },
    ],
    questions: [
      {
        id: "question-1",
        pillarId: "pillar-removed",
        orderKey: "key-1",
        type: "yes-no",
        text: "Are controls documented?",
        riskLevel: "high",
        importance: "Prevents gaps",
        checklistItems: "[]",
        leadingPractices: "[]",
        helpfulLinks: "[]",
      },
    ],
  });
  const { saveLocalTemplateDraft } =
    await import("~/composables/templates/storage/useTemplatePersistence");

  await saveLocalTemplateDraft(template, "revision-1");

  const questionMove = writes.findIndex(
    ({ operation, table }) =>
      operation === "update" && table === "template_questions"
  );
  const pillarDelete = writes.findIndex(
    ({ operation, table }) =>
      operation === "delete" && table === "template_pillars"
  );
  expect(questionMove).toBeGreaterThanOrEqual(0);
  expect(pillarDelete).toBeGreaterThanOrEqual(0);
  expect(questionMove).toBeLessThan(pillarDelete);
});
