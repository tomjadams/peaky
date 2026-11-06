import { getTableName } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { cachePublishedTemplateRevisions } from "~/services/template/TemplateRevisionSnapshotCache";

const mocks = vi.hoisted(() => ({
  fetchTemplateAuthoringDetail: vi.fn(),
  localOnly: vi.fn(),
}));

vi.mock("~/composables/templates/domain/useTemplateCatalog", () => ({
  fetchTemplateAuthoringDetail: mocks.fetchTemplateAuthoringDetail,
}));

vi.mock("~/composables/local/useLocalTemplateDrafts", () => ({
  fetchLocalTemplateDrafts: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/services/local-mutation", () => ({
  localMutation: { localOnly: mocks.localOnly },
}));

const detail = {
  template: {
    id: "template-1",
    name: "Operational Readiness",
    description: "Template metadata",
    status: "active",
    ownerTeamId: "team-platform",
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
  },
  revision: {
    id: "revision-1",
    templateId: "template-1",
    name: "Published Operational Readiness",
    description: "Immutable snapshot",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: "actor-system",
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
    publishedAt: "2026-08-20T10:00:00Z",
    pillars: [
      {
        id: "pillar-1",
        templateRevisionId: "revision-1",
        slug: "reliability",
        name: "Reliability",
        order: 1,
        questions: [
          {
            id: "question-1",
            order: 1,
            type: "yes-no",
            text: "Is the service reliable?",
            riskLevel: "high",
            importance: "Reliability matters",
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
    ],
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchTemplateAuthoringDetail.mockResolvedValue(detail);
});

it("caches an exact published Revision snapshot without outbox transport", async () => {
  const writes: string[] = [];
  mocks.localOnly.mockImplementation(async ({ stateWrite }) => {
    await stateWrite({
      insert(table: Parameters<typeof getTableName>[0]) {
        return {
          values() {
            writes.push(getTableName(table));
            return { onConflictDoNothing: () => Promise.resolve() };
          },
        };
      },
    });
  });

  await expect(
    cachePublishedTemplateRevisions(["revision-1"])
  ).resolves.toEqual([detail]);
  expect(writes).toEqual([
    "templates",
    "template_revisions",
    "template_pillars",
    "template_questions",
  ]);
  expect(mocks.localOnly).toHaveBeenCalledOnce();
});

it("rejects a non-published snapshot before local writes", async () => {
  mocks.fetchTemplateAuthoringDetail.mockResolvedValue({
    ...detail,
    revision: { ...detail.revision, status: "draft", revisionNumber: null },
  });

  await expect(cachePublishedTemplateRevisions(["revision-1"])).rejects.toThrow(
    /current published Revisions/
  );
  expect(mocks.localOnly).not.toHaveBeenCalled();
});
