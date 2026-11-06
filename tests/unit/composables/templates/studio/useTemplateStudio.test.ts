import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateRevisionDetail } from "~/models";

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
  createEmptyTemplate: () => ({
    id: "",
    templateId: "",
    name: "Untitled Template",
    description: "",
    status: "draft",
    revisionNumber: null,
    revisionSummary: null,
    createdByActorId: "",
    updatedByActorId: "",
    publishedByActorId: null,
    createdAt: "2026-08-21T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
    publishedAt: null,
    pillars: [],
  }),
  fetchTemplateAuthoringDetail: mocks.fetchTemplateAuthoringDetail,
}));

vi.mock("~/composables/templates/storage/useTemplatePersistence", () => ({
  importTemplateMarkdown: vi.fn(() => Promise.resolve([])),
  resolveTemplateImportConflict: vi.fn(),
  saveLocalTemplateDraft: mocks.saveLocalTemplateDraft,
  saveTemplateDraftMetadata: vi.fn(),
}));

const publishedTemplate = {
  id: "template-1",
  name: "Current Operational Readiness",
  description: "Current aggregate metadata",
  status: "active" as const,
  ownerTeamId: "team-platform",
  createdByActorId: "actor-creator",
  updatedByActorId: "actor-editor",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T09:00:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const publishedRevision: TemplateRevisionDetail = {
  id: "revision-published-3",
  templateId: "template-1",
  name: "Published Operational Readiness",
  description: "Immutable snapshot",
  status: "published",
  revisionNumber: 3,
  revisionSummary: "Third publication",
  createdByActorId: "actor-creator",
  updatedByActorId: "actor-editor",
  publishedByActorId: "actor-publisher",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T09:00:00.000Z",
  publishedAt: "2026-08-20T10:00:00.000Z",
  pillars: [
    {
      id: "pillar-1",
      templateRevisionId: "revision-published-3",
      slug: "reliability",
      name: "Reliability",
      order: 1,
      questions: [],
    },
  ],
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.canEditTemplateDraft.mockResolvedValue(true);
  mocks.createLocalTemplateDraft.mockResolvedValue("revision-new");
  mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue(null);
  mocks.fetchLocalTemplateRevisionRecordById.mockResolvedValue(null);
  mocks.persistPublishedTemplateRevisions.mockResolvedValue(undefined);
  mocks.fetchPersistedDirectoryGroups.mockResolvedValue([
    { id: "team-platform", displayName: "Platform Engineering" },
  ]);
  mocks.fetchTemplateAuthoringDetail.mockResolvedValue({
    template: structuredClone(publishedTemplate),
    revision: structuredClone(publishedRevision),
  });
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

describe("Template loading", () => {
  it("starts the local template and owner Team reads together", async () => {
    const groups = deferred<{ id: string; displayName: string }[]>();
    const localDraft = deferred<null>();
    mocks.fetchPersistedDirectoryGroups.mockReturnValue(groups.promise);
    mocks.fetchLocalTemplateDraftRecordById.mockReturnValue(localDraft.promise);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");

    const loading = useTemplateStudio().loadTemplate("revision-existing", true);
    expect(mocks.fetchPersistedDirectoryGroups).toHaveBeenCalledOnce();
    expect(mocks.fetchLocalTemplateDraftRecordById).toHaveBeenCalledOnce();

    groups.resolve([
      { id: "team-platform", displayName: "Platform Engineering" },
    ]);
    localDraft.resolve(null);
    await loading;
    expect(mocks.persistPublishedTemplateRevisions).toHaveBeenCalledOnce();
  });

  it("uses the local published revision before the authoring API", async () => {
    mocks.fetchLocalTemplateRevisionRecordById.mockResolvedValue({
      aggregate: structuredClone(publishedTemplate),
      ownerTeamId: "team-platform",
      template: structuredClone(publishedRevision),
    });
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-published-3", true);

    expect(studio.template.value?.id).toBe("revision-published-3");
    expect(mocks.fetchTemplateAuthoringDetail).not.toHaveBeenCalled();
  });
});

describe("new Template owner Team selection", () => {
  it("blocks first save with field feedback when no persisted Team is available", async () => {
    mocks.fetchPersistedDirectoryGroups.mockResolvedValue([]);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("new", true);
    studio.updateTemplateName("New Template");

    await expect(studio.saveTemplate()).resolves.toBe(false);
    expect(studio.ownerTeamError.value).toMatch(/owner team/i);
    expect(mocks.createLocalTemplateDraft).not.toHaveBeenCalled();
    expect(mocks.saveLocalTemplateDraft).not.toHaveBeenCalled();
  });

  it("rejects a selected Team absent from the persisted snapshot", async () => {
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("new", true);
    studio.updateTemplateName("New Template");
    studio.setOwnerTeamId("team-unknown");

    await expect(studio.saveTemplate()).resolves.toBe(false);
    expect(studio.ownerTeamError.value).toMatch(/owner team/i);
    expect(mocks.createLocalTemplateDraft).not.toHaveBeenCalled();
  });

  it("rejects owner changes after the initial Template is persisted", async () => {
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue({
      aggregate: structuredClone(publishedTemplate),
      draftId: "revision-existing",
      ownerTeamId: "team-platform",
      template: {
        ...publishedRevision,
        id: "revision-existing",
        status: "draft",
        revisionNumber: null,
        revisionSummary: null,
        publishedByActorId: null,
        publishedAt: null,
      },
    });
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-existing", true);
    studio.setOwnerTeamId("team-other");

    expect(studio.ownerTeamId.value).toBe("team-platform");
    expect(studio.isDirty.value).toBe(false);
    expect(mocks.saveLocalTemplateDraft).not.toHaveBeenCalled();
  });

  it("creates the Template and initial draft with the selected persisted Team", async () => {
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValueOnce({
      aggregate: {
        ...publishedTemplate,
        id: "template-new",
        name: "New Template",
      },
      draftId: "revision-new",
      ownerTeamId: "team-platform",
      template: {
        ...publishedRevision,
        id: "revision-new",
        templateId: "template-new",
        name: "New Template",
        description: "",
        status: "draft",
        revisionNumber: null,
        revisionSummary: null,
        createdByActorId: "actor-editor",
        updatedByActorId: "actor-editor",
        publishedByActorId: null,
        publishedAt: null,
        pillars: [],
      },
    });
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("new", true);
    expect(studio.ownerTeamOptions.value).toEqual([
      { label: "Platform Engineering", value: "team-platform" },
    ]);

    studio.updateTemplateName("New Template");
    studio.setOwnerTeamId("team-platform");

    await expect(studio.saveTemplate()).resolves.toBe(true);
    expect(mocks.createLocalTemplateDraft).toHaveBeenCalledWith({
      name: "New Template",
      description: "",
      ownerTeamId: "team-platform",
      actorId: "actor-editor",
      maturityDefinition: expect.any(String),
      pillars: [],
    });
    expect(studio.localDraftId.value).toBe("revision-new");
    expect(studio.templateAggregate.value?.id).toBe("template-new");
    expect(studio.template.value).toMatchObject({
      id: "revision-new",
      templateId: "template-new",
      createdByActorId: "actor-editor",
      updatedByActorId: "actor-editor",
    });
    expect(studio.ownerTeamError.value).toBeNull();
  });
});

describe("Studio edit entitlement", () => {
  const localDraft = () => ({
    aggregate: structuredClone(publishedTemplate),
    draftId: "revision-existing",
    ownerTeamId: "team-platform",
    template: {
      ...publishedRevision,
      id: "revision-existing",
      status: "draft" as const,
      revisionNumber: null,
      revisionSummary: null,
      publishedByActorId: null,
      publishedAt: null,
    },
  });

  it("keeps a directly opened local draft read-only when access is denied", async () => {
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue(localDraft());
    mocks.canEditTemplateDraft.mockResolvedValue(false);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-existing", true);
    studio.updateTemplateName("Denied mutation");

    expect(studio.isEditable.value).toBe(false);
    expect(studio.template.value?.name).toBe("Published Operational Readiness");
    expect(studio.isDirty.value).toBe(false);
  });

  it("applies structure and content mutations to an editable local draft", async () => {
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue(localDraft());
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-existing", true);
    studio.addPillar("Capacity", "capacity");
    studio.addQuestion("capacity", "Can the service scale?", "yes-no");
    const question = studio.template.value?.pillars.at(-1)?.questions[0];
    expect(question).toBeDefined();

    studio.addPractice("capacity", question!.id, "Run load tests");
    studio.addChecklistItem("capacity", question!.id, "Document limits");
    studio.addLink("capacity", question!.id, {
      title: "Capacity guide",
      url: "https://example.com/capacity",
    });

    expect(studio.template.value?.pillars.at(-1)).toMatchObject({
      name: "Capacity",
      slug: "capacity",
    });
    expect(question).toMatchObject({
      text: "Can the service scale?",
      leadingPractices: expect.arrayContaining([
        expect.objectContaining({ text: "Run load tests" }),
      ]),
      checklistItems: [expect.objectContaining({ text: "Document limits" })],
      helpfulLinks: expect.arrayContaining([
        expect.objectContaining({ title: "Capacity guide" }),
      ]),
    });
    expect(studio.isDirty.value).toBe(true);
  });

  it("rejects a save when the cached edit entitlement was revoked", async () => {
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue(localDraft());
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-existing", true);
    studio.updateTemplateName("Pending edit");
    mocks.canEditTemplateDraft.mockResolvedValue(false);

    await expect(studio.saveTemplate()).resolves.toBe(false);
    expect(studio.isEditable.value).toBe(false);
    expect(studio.isDirty.value).toBe(true);
    expect(mocks.saveLocalTemplateDraft).not.toHaveBeenCalled();
  });
});

describe("Studio save serialization", () => {
  it("coalesces overlapping first saves into one Template creation", async () => {
    const creation = deferred<string>();
    mocks.createLocalTemplateDraft.mockReturnValueOnce(creation.promise);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("new", true);
    studio.updateTemplateName("New Template");
    studio.setOwnerTeamId("team-platform");
    const firstSave = studio.saveTemplate();
    const secondSave = studio.saveTemplate();

    expect(mocks.createLocalTemplateDraft).toHaveBeenCalledOnce();
    creation.resolve("revision-new");
    await expect(Promise.all([firstSave, secondSave])).resolves.toEqual([
      true,
      true,
    ]);
    expect(mocks.createLocalTemplateDraft).toHaveBeenCalledOnce();
  });

  it("ignores save completion after another Studio session loads", async () => {
    const firstWrite = deferred<string>();
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValueOnce({
      aggregate: structuredClone(publishedTemplate),
      draftId: "revision-existing",
      ownerTeamId: "team-platform",
      template: {
        ...publishedRevision,
        id: "revision-existing",
        status: "draft",
        revisionNumber: null,
        revisionSummary: null,
        publishedByActorId: null,
        publishedAt: null,
      },
    });
    mocks.saveLocalTemplateDraft.mockReturnValueOnce(firstWrite.promise);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-existing", true);
    studio.updateTemplateName("Template A edit");
    const firstSave = studio.saveTemplate();
    await studio.loadTemplate("new", true);
    firstWrite.resolve("revision-existing");
    await firstSave;

    expect(studio.template.value?.name).toBe("Untitled Template");
    expect(studio.template.value?.id).toBe("");
    expect(studio.templateAggregate.value?.id).toBe("");
    expect(studio.localDraftId.value).toBeNull();
    expect(studio.isDirty.value).toBe(false);
  });

  it("keeps edits made during a save dirty until a follow-up save completes", async () => {
    const firstWrite = deferred<string>();
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue({
      aggregate: structuredClone(publishedTemplate),
      draftId: "revision-existing",
      ownerTeamId: "team-platform",
      template: {
        ...publishedRevision,
        id: "revision-existing",
        status: "draft",
        revisionNumber: null,
        revisionSummary: null,
        publishedByActorId: null,
        publishedAt: null,
      },
    });
    mocks.saveLocalTemplateDraft.mockReturnValueOnce(firstWrite.promise);
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate("revision-existing", true);
    studio.updateTemplateName("First edit");
    const firstSave = studio.saveTemplate();
    studio.updateTemplateName("Second edit");
    firstWrite.resolve("revision-existing");
    await firstSave;

    expect(studio.isDirty.value).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.saveLocalTemplateDraft).toHaveBeenCalledTimes(2);
    expect(studio.isDirty.value).toBe(false);
  });
});

describe("immutable published Revision Studio state", () => {
  it("keeps an archived Template draft read-only", async () => {
    const archivedTemplate = {
      ...publishedTemplate,
      status: "archived" as const,
    };
    const archivedDraft: TemplateRevisionDetail = {
      ...publishedRevision,
      id: "revision-archived-draft",
      status: "draft",
      revisionNumber: null,
      revisionSummary: null,
      publishedByActorId: null,
      publishedAt: null,
    };
    mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue({
      aggregate: archivedTemplate,
      draftId: archivedDraft.id,
      ownerTeamId: archivedTemplate.ownerTeamId,
      template: archivedDraft,
    });
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();

    await studio.loadTemplate(archivedDraft.id, true);
    studio.updateTemplateName("Must not change");
    studio.addPillar("injected", "Injected pillar");
    await vi.advanceTimersByTimeAsync(2000);

    expect(studio.template.value).toEqual(archivedDraft);
    expect(studio.isEditable.value).toBe(false);
    expect(studio.isDirty.value).toBe(false);
    expect(mocks.saveLocalTemplateDraft).not.toHaveBeenCalled();
  });

  it("keeps the complete snapshot read-only and schedules no local save", async () => {
    mocks.fetchTemplateAuthoringDetail.mockResolvedValue({
      template: {
        ...structuredClone(publishedTemplate),
        ownerTeamId: "team-missing-from-mirror",
      },
      revision: structuredClone(publishedRevision),
    });
    const { useTemplateStudio } =
      await import("~/composables/templates/studio/useTemplateStudio");
    const studio = useTemplateStudio();
    await studio.loadTemplate("revision-published-3", true);
    expect(studio.templateAggregate.value?.name).toBe(
      "Current Operational Readiness"
    );
    expect(studio.canEditDraft.value).toBe(true);
    expect(studio.isEditable.value).toBe(false);
    expect(mocks.canEditTemplateDraft).toHaveBeenCalledWith("template-1");
    const originalSnapshot = JSON.parse(
      JSON.stringify(studio.template.value)
    ) as TemplateRevisionDetail;

    studio.updateTemplateName("Mutated name");
    studio.updateTemplateDescription("Mutated description");
    studio.importTemplate({ name: "Imported mutation", pillars: [] });
    studio.addPillar("injected", "Injected pillar");
    await vi.advanceTimersByTimeAsync(2000);

    expect(studio.template.value).toEqual(originalSnapshot);
    expect(studio.isDirty.value).toBe(false);
    expect(mocks.saveLocalTemplateDraft).not.toHaveBeenCalled();
  });
});
