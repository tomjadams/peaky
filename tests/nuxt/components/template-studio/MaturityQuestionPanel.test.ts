import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/vue";
import type { TemplateRevisionDetail } from "~/models";
import MaturityQuestionPanel from "~/components/template-studio/MaturityQuestionPanel.vue";

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

const YES_NO_QUESTION = {
  id: "q-1",
  order: 1,
  type: "yes-no" as const,
  text: "Are alerts routed to an owner?",
  riskLevel: "high" as const,
  importance: "Prevents missed incidents",
  checklistItems: [],
  leadingPractices: [],
  helpfulLinks: [],
};

const CHECKLIST_QUESTION = {
  id: "q-2",
  order: 2,
  type: "checklist" as const,
  text: "Which signals are dashboarded?",
  riskLevel: "medium" as const,
  importance: "Keeps health visible",
  checklistItems: [
    { id: "c-1", order: 1, text: "Latency" },
    { id: "c-2", order: 2, text: "Errors" },
  ],
  leadingPractices: [],
  helpfulLinks: [],
};

function draftRevision(): TemplateRevisionDetail {
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
          structuredClone(YES_NO_QUESTION),
          structuredClone(CHECKLIST_QUESTION),
        ],
      },
    ],
  };
}

async function renderPanel(
  questionId: string,
  options: {
    mode?: "question" | "bulk" | "practice";
    practiceId?: string;
    practiceText?: string;
    practiceIndex?: number;
    readonly?: boolean;
  } = {}
) {
  mocks.fetchLocalTemplateDraftRecordById.mockResolvedValue({
    aggregate: structuredClone(activeTemplateAggregate),
    draftId: "revision-existing",
    ownerTeamId: "team-platform",
    template: draftRevision(),
  });
  const { useTemplateStudio } =
    await import("~/composables/templates/studio/useTemplateStudio");
  const studio = useTemplateStudio();
  await studio.loadTemplate("revision-existing", true);
  const question = questionId === "q-1" ? YES_NO_QUESTION : CHECKLIST_QUESTION;
  const view = render(MaturityQuestionPanel, {
    props: {
      question: structuredClone(question),
      ...options,
    },
  });
  return { studio, view };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.canEditTemplateDraft.mockResolvedValue(true);
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
  state.setMaturityReconcileHook(null);
});

afterEach(cleanup);

describe("follow-up placement", () => {
  it("associates a yes-no question without changing score ranges", async () => {
    const { studio, view } = await renderPanel("q-1");
    const scoreRanges = [
      ...(studio.maturityDefinition.value?.thresholds ?? []),
    ];
    const scoreTrace = JSON.stringify(studio.workedExample.value);

    const trigger = screen.getByRole("combobox", {
      name: "Follow-up placement for this question",
    });
    expect(trigger.textContent).toContain("Stage 1 · Not implemented");
    expect(trigger.textContent).not.toContain(
      "Practices are absent or not yet repeatable."
    );
    await fireEvent.pointerDown(trigger, { button: 0 });
    const measuredOption = await screen.findByRole("option", {
      name: /Stage 4 · Measured/,
    });
    expect(
      screen.getByText("Practices are measured and improved using evidence.")
    ).toBeTruthy();
    expect(
      measuredOption.closest('[data-slot="content"]')?.className
    ).toContain("w-[min(24rem,calc(100vw-2rem))]");
    await fireEvent.keyDown(measuredOption, { key: "Enter" });

    expect(studio.maturityDefinition.value?.associations.questions["q-1"]).toBe(
      4
    );
    expect(studio.maturityDefinition.value?.thresholds).toEqual(scoreRanges);
    expect(JSON.stringify(studio.workedExample.value)).toBe(scoreTrace);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Score unchanged. This item is grouped under Stage 4 · Measured in Follow-ups."
      )
    );
    expect(view.emitted()["placement-change"]?.[0]).toEqual([
      "Score unchanged. This item is grouped under Stage 4 · Measured in Follow-ups.",
    ]);
  });

  it("bulk-assigns every checklist Follow-up placement", async () => {
    const { studio } = await renderPanel("q-2", { mode: "bulk" });

    const bulkPlacement = screen.getByRole("combobox", {
      name: "Set all Follow-up placements",
    });
    await fireEvent.pointerDown(bulkPlacement, {
      button: 0,
      pointerType: "mouse",
    });
    const stageThreeOption = await screen.findByRole("option", {
      name: /Stage 3 · Defined/,
    });
    await fireEvent.keyDown(stageThreeOption, { key: "Enter" });

    expect(
      studio.maturityDefinition.value?.associations.practices["q-2"]
    ).toEqual({ "c-1": 3, "c-2": 3 });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Score unchanged. All practices are grouped under Stage 3 · Defined in Follow-ups."
      )
    );
  });

  it("moves one checklist practice with a concrete accessible name", async () => {
    const { studio } = await renderPanel("q-2", {
      mode: "practice",
      practiceId: "c-2",
      practiceText: "Errors",
    });

    const trigger = screen.getByRole("combobox", {
      name: "Follow-up placement for Errors",
    });
    expect(trigger.id).toContain("follow-up-placement-q-2-c-2");
    const controlledId = trigger.getAttribute("aria-controls");
    expect(controlledId).toBeTruthy();

    await fireEvent.pointerDown(trigger, { button: 0 });
    const option = await screen.findByRole("option", {
      name: /Stage 5 · Optimized/,
    });
    expect(trigger.getAttribute("aria-controls")).toBe(controlledId);
    expect(document.getElementById(controlledId!)).toBeTruthy();
    const labelledElements = screen
      .getByRole("listbox")
      .querySelectorAll<HTMLElement>("[aria-labelledby]");
    for (const element of labelledElements) {
      expect(
        document.getElementById(element.getAttribute("aria-labelledby")!)
      ).toBeTruthy();
    }
    expect(option.closest('[data-slot="content"]')?.className).toContain(
      "z-[60]"
    );
    expect(option.className).toContain("text-[15px]");
    await fireEvent.keyDown(option, { key: "Enter" });
    expect(trigger.getAttribute("aria-controls")).not.toBe("");

    expect(
      studio.maturityDefinition.value?.associations.practices["q-2"]
    ).toEqual({ "c-1": 1, "c-2": 5 });
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe("true");
  });

  it("gives a blank practice a stable numbered accessible name", async () => {
    await renderPanel("q-2", {
      mode: "practice",
      practiceId: "c-2",
      practiceText: "  ",
      practiceIndex: 2,
    });

    expect(
      screen.getByRole("combobox", {
        name: "Follow-up placement for practice 2",
      })
    ).toBeTruthy();
  });

  it("does not expose practice-share controls", async () => {
    await renderPanel("q-2", { mode: "practice", practiceId: "c-1" });

    expect(screen.queryByText(/custom shares/i)).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("disables the placement control in read-only mode", async () => {
    await renderPanel("q-2", {
      mode: "practice",
      practiceId: "c-1",
      practiceText: "Latency",
      readonly: true,
    });

    expect(
      screen.getByRole("combobox", { name: "Follow-up placement for Latency" })
    ).toHaveProperty("disabled", true);
  });
});
