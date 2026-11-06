/**
 * Studio maturity state: loads the stored definition or configured defaults,
 * applies pure authoring operations under the editability guard, reconciles
 * after structural mutations, blocks local save while invalid, and commits the
 * serialized document atomically with template content (maturity-score/AC-009,
 * AC-010, AC-048 through AC-050, AC-063).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateRevisionDetail } from "~/models";
import type { MaturityDefinition } from "~/services/maturity/definition";
import { buildDefaultMaturityDefinition } from "~/services/maturity/defaults";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import { adjustThreshold } from "~/services/maturity/authoring";

const mocks = vi.hoisted(() => ({
  canEditTemplateDraft: vi.fn(),
  createLocalTemplateDraft: vi.fn(),
  fetchLocalTemplateDraftRecordById: vi.fn(),
  fetchLocalTemplateRevisionRecordById: vi.fn(),
  fetchPersistedDirectoryGroups: vi.fn(),
  fetchTemplateAuthoringDetail: vi.fn(),
  persistPublishedTemplateRevisions: vi.fn(),
  saveLocalTemplateDraft: vi.fn(),
}));

vi.mock("~/composables/local/useLocalTemplateDraft", () => ({
  createLocalTemplateDraft: mocks.createLocalTemplateDraft,
  fetchLocalTemplateDraftRecordById: mocks.fetchLocalTemplateDraftRecordById,
  fetchLocalTemplateRevisionRecordById:
    mocks.fetchLocalTemplateRevisionRecordById,
}));

vi.mock("~/catalog-directory-mirror/local", () => ({
  fetchPersistedDirectoryGroups: mocks.fetchPersistedDirectoryGroups,
}));

vi.mock("~/services/template/TemplateRevisionSnapshotCache", () => ({
  persistPublishedTemplateRevisions: mocks.persistPublishedTemplateRevisions,
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: () => ({
    id: "actor-editor",
    name: "Editor",
    roles: ["member"],
  }),
}));

vi.mock("~/composables/templates/domain/useTemplateCatalog", () => ({
  canEditTemplateDraft: mocks.canEditTemplateDraft,
  createEmptyTemplate: () => ({}),
  fetchTemplateAuthoringDetail: mocks.fetchTemplateAuthoringDetail,
}));

vi.mock("~/composables/templates/storage/useTemplatePersistence", () => ({
  importTemplateMarkdown: vi.fn(() => Promise.resolve([])),
  resolveTemplateImportConflict: vi.fn(),
  saveLocalTemplateDraft: mocks.saveLocalTemplateDraft,
  saveTemplateDraftMetadata: vi.fn(),
}));

const activeTemplateAggregate = {
  id: "template-1",
  name: "Operational Readiness",
  description: "Aggregate metadata",
  status: "active" as const,
  ownerTeamId: "team-platform",
  createdByActorId: "actor-creator",
  updatedByActorId: "actor-editor",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T09:00:00.000Z",
};

function draftRevision(
  overrides: Partial<TemplateRevisionDetail> = {}
): TemplateRevisionDetail {
  return {
    id: "revision-existing",
    templateId: "template-1",
    name: "Operational Readiness",
    description: "Draft revision",
    status: "draft",
    revisionNumber: null,
    revisionSummary: null,
    createdByActorId: "actor-creator",
    updatedByActorId: "actor-editor",
    publishedByActorId: null,
    createdAt: "2026-08-20T08:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    publishedAt: null,
    pillars: [
      {
        id: "pillar-1",
        templateRevisionId: "revision-existing",
        slug: "reliability",
        name: "Reliability",
        order: 1,
        questions: [
          {
            id: "q-1",
            order: 1,
            type: "yes-no",
            text: "Are alerts routed to an owner?",
            riskLevel: "high",
            importance: "Prevents missed incidents",
            checklistItems: [],
            leadingPractices: [],
            helpfulLinks: [],
          },
          {
            id: "q-2",
            order: 2,
            type: "checklist",
            text: "Which signals are dashboarded?",
            riskLevel: "medium",
            importance: "Keeps health visible",
            checklistItems: [
              { id: "c-1", order: 1, text: "Latency" },
              { id: "c-2", order: 2, text: "Errors" },
            ],
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function mockEditableDraft(revision: TemplateRevisionDetail) {
  mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue({
    aggregate: structuredClone(activeTemplateAggregate),
    draftId: "revision-existing",
    ownerTeamId: "team-platform",
    template: revision,
  });
}

async function loadStudio(revision: TemplateRevisionDetail) {
  mockEditableDraft(revision);
  const { useTemplateStudio } =
    await import("~/composables/templates/studio/useTemplateStudio");
  const studio = useTemplateStudio();
  await studio.loadTemplate("revision-existing", true);
  return studio;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.canEditTemplateDraft.mockResolvedValue(true);
  mocks.createLocalTemplateDraft.mockResolvedValue("revision-new");
  mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue(null);
  mocks.fetchLocalTemplateRevisionRecordById.mockResolvedValue(null);
  mocks.fetchPersistedDirectoryGroups.mockResolvedValue([
    { id: "team-platform", displayName: "Platform Engineering" },
  ]);
  mocks.saveLocalTemplateDraft.mockResolvedValue("revision-existing");

  const state =
    await import("~/composables/templates/studio/useTemplateStudio-state");
  if (state.saveTimeout.value) clearTimeout(state.saveTimeout.value);
  state.template.value = null;
  state.templateAggregate.value = null;
  state.activePillarSlug.value = null;
  state.expandedQuestionId.value = null;
  state.saveStatus.value = "idle";
  state.lastSavedAt.value = null;
  state.isDirty.value = false;
  state.mutationGeneration.value = 0;
  state.isLoading.value = false;
  state.localDraftId.value = null;
  state.hasEditEntitlement.value = false;
  state.importConflicts.value = [];
  state.setSaveTimeout(null);
  state.setScheduleAutoSaveHook(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("load", () => {
  it("presents configured defaults when the draft has no stored definition (AC-010, AC-049)", async () => {
    const studio = await loadStudio(draftRevision());

    const definition = studio.maturityDefinition.value;
    expect(definition?.thresholds).toEqual([5, 25, 50, 75]);
    expect(definition?.associations.questions).toEqual({ "q-1": 1, "q-2": 1 });
    expect(definition?.allocations["q-2"]).toEqual({ mode: "equal" });
    expect(studio.maturityIssues.value).toEqual([]);
  });

  it("moves the former equal-band draft default to the current profile", async () => {
    const stored = buildDefaultMaturityDefinition([
      {
        questionId: "q-1",
        pillarId: "pillar-1",
        severity: "high",
        type: "yes-no",
        practiceIds: [],
      },
      {
        questionId: "q-2",
        pillarId: "pillar-1",
        severity: "medium",
        type: "checklist",
        practiceIds: ["c-1", "c-2"],
      },
    ]);
    const legacy: MaturityDefinition = {
      ...stored,
      thresholds: [20, 40, 60, 80],
    };

    const studio = await loadStudio(
      draftRevision({ maturityDefinition: serializeMaturityDefinition(legacy) })
    );

    expect(studio.maturityDefinition.value?.thresholds).toEqual([
      5, 25, 50, 75,
    ]);
  });

  it("decodes the stored document instead of inventing defaults (AC-009)", async () => {
    const stored = buildDefaultMaturityDefinition([
      {
        questionId: "q-1",
        pillarId: "pillar-1",
        severity: "high",
        type: "yes-no",
        practiceIds: [],
      },
      {
        questionId: "q-2",
        pillarId: "pillar-1",
        severity: "medium",
        type: "checklist",
        practiceIds: ["c-1", "c-2"],
      },
    ]);
    const custom: MaturityDefinition = {
      ...stored,
      thresholds: [15, 40, 60, 80],
    };
    const studio = await loadStudio(
      draftRevision({ maturityDefinition: serializeMaturityDefinition(custom) })
    );

    expect(studio.maturityDefinition.value?.thresholds).toEqual([
      15, 40, 60, 80,
    ]);
  });
});

describe("withMaturityMutation", () => {
  it("applies a pure authoring operation, serializes onto the draft, and marks dirty (AC-032, AC-063)", async () => {
    const studio = await loadStudio(draftRevision());

    const applied = studio.withMaturityMutation((definition) =>
      adjustThreshold(definition, 0, 10)
    );

    expect(applied).toBe(true);
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(10);
    expect(studio.template.value?.maturityDefinition).toBe(
      serializeMaturityDefinition(studio.maturityDefinition.value!)
    );
    expect(studio.isDirty.value).toBe(true);
  });

  it("refuses edits when the Revision is not editable", async () => {
    mocks.fetchTemplateAuthoringDetail.mockResolvedValue({
      template: structuredClone(activeTemplateAggregate),
      revision: draftRevision({
        id: "revision-published-3",
        status: "published",
        revisionNumber: 3,
        publishedAt: "2026-08-20T10:00:00.000Z",
      }),
    });
    mocks.canEditTemplateDraft.mockResolvedValue(false);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();
    await studio.loadTemplate("revision-published-3", true);

    const applied = studio.withMaturityMutation((definition) =>
      adjustThreshold(definition, 0, 25)
    );

    expect(applied).toBe(false);
    expect(studio.maturityDefinition.value?.thresholds).toEqual([
      5, 25, 50, 75,
    ]);
    expect(studio.template.value?.maturityDefinition).toBeUndefined();
    expect(studio.isDirty.value).toBe(false);
  });
});

describe("structural reconciliation (AC-050, AC-053)", () => {
  it("associates a new Question with stage 1 in authored order", async () => {
    const studio = await loadStudio(draftRevision());

    studio.addQuestion("reliability", "Are runbooks current?", "yes-no");

    const definition = studio.maturityDefinition.value!;
    const newQuestion = studio.template.value!.pillars[0]!.questions[2]!;
    expect(definition.associations.questions[newQuestion.id]).toBe(1);
    expect(
      definition.associations.stageOrder[1].map((e) => e.questionId)
    ).toEqual(["q-1", "q-2", newQuestion.id]);
  });

  it("drops every maturity row of a removed Question", async () => {
    const studio = await loadStudio(draftRevision());

    studio.deleteQuestion("reliability", "q-2");

    const definition = studio.maturityDefinition.value!;
    expect(definition.associations.questions["q-2"]).toBeUndefined();
    expect(definition.allocations["q-2"]).toBeUndefined();
    expect(studio.maturityIssues.value).toEqual([]);
  });

  it("adds an equal allocation when a Question becomes a checklist", async () => {
    const studio = await loadStudio(draftRevision());

    studio.updateQuestion("reliability", "q-1", {
      type: "checklist",
      checklistItems: [{ id: "c-9", order: 1, text: "Latency" }],
    });

    expect(studio.maturityDefinition.value!.allocations["q-1"]).toEqual({
      mode: "equal",
    });
    expect(studio.maturityIssues.value).toEqual([]);
  });

  it("keeps checklist content reversible while excluding it from yes/no structure", async () => {
    const studio = await loadStudio(draftRevision());

    studio.updateQuestion("reliability", "q-2", { type: "yes-no" });

    const retyped = studio.template.value!.pillars[0]!.questions[1]!;
    expect(retyped.checklistItems?.map((item) => item.id)).toEqual([
      "c-1",
      "c-2",
    ]);
    expect(studio.maturityDefinition.value!.allocations["q-2"]).toBeUndefined();
    expect(
      studio.maturityDefinition.value!.associations.practices["q-2"]
    ).toBeUndefined();

    studio.updateQuestion("reliability", "q-2", { type: "checklist" });

    expect(
      studio.template.value!.pillars[0]!.questions[1]!.checklistItems?.map(
        (item) => item.id
      )
    ).toEqual(["c-1", "c-2"]);
    expect(studio.maturityDefinition.value!.allocations["q-2"]).toEqual({
      mode: "equal",
    });
  });

  it("keeps the worked example in step with severity edits (AC-048)", async () => {
    const studio = await loadStudio(draftRevision());
    const before = studio.workedExample.value;
    if (before?.kind !== "result")
      throw new Error("expected an example result");

    studio.updateQuestion("reliability", "q-1", { riskLevel: "critical" });

    const after = studio.workedExample.value;
    if (after?.kind !== "result") throw new Error("expected an example result");
    expect(after.trace.earned).not.toEqual(before.trace.earned);
  });
});

describe("local-save validation (AC-063)", () => {
  it("blocks the local save with field-addressable issues while invalid", async () => {
    const studio = await loadStudio(draftRevision());
    studio.withMaturityMutation((definition) =>
      adjustThreshold(definition, 0, 35)
    );

    await expect(studio.saveTemplate()).resolves.toBe(false);

    expect(mocks.saveLocalTemplateDraft).not.toHaveBeenCalled();
    expect(studio.saveStatus.value).toBe("error");
    const issues = studio.maturitySaveIssues.value;
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "threshold-out-of-tolerance",
          path: "thresholds[0]",
        }),
      ])
    );
    for (const issue of issues) {
      expect(issue.path.length).toBeGreaterThan(0);
    }
    expect(studio.isDirty.value).toBe(true);
  });

  it("commits the serialized definition atomically with template content", async () => {
    const studio = await loadStudio(draftRevision());
    studio.withMaturityMutation((definition) =>
      adjustThreshold(definition, 0, 10)
    );

    await expect(studio.saveTemplate()).resolves.toBe(true);

    expect(studio.maturitySaveIssues.value).toEqual([]);
    expect(mocks.saveLocalTemplateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        maturityDefinition: serializeMaturityDefinition(
          studio.maturityDefinition.value!
        ),
      }),
      "revision-existing"
    );
  });
});
