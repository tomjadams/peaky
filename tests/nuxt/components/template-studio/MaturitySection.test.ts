import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/vue";
import type { TemplateRevisionDetail } from "~/models";
import MaturitySection from "~/components/template-studio/MaturitySection.vue";
import { MATURITY_STAGES } from "~/services/maturity/stages";

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
  };
}

async function loadEditableStudio() {
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
  return studio;
}

function expectVisibleRange(range: string) {
  expect(
    screen
      .getAllByText(range)
      .some((element) => element.closest('[role="tooltip"]') === null)
  ).toBe(true);
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function openScoreRanges() {
  const trigger = screen.getByRole("button", { name: "Adjust score ranges" });
  await fireEvent.click(trigger);
  return trigger;
}

function scoreRangeSlider(index: 0 | 1 | 2 | 3) {
  return screen.getByRole("slider", {
    name: `Stage ${index + 2} ${MATURITY_STAGES[index + 1]!.name} starts at`,
  });
}

describe("maturity score", () => {
  it("keeps stable closed labels, chevrons, stages, and Preview entry", async () => {
    await loadEditableStudio();
    const view = render(MaturitySection);

    expect(
      screen.getByRole("heading", { name: "Maturity score" })
    ).toBeTruthy();
    expect(screen.getByText("Whole template · all pillars")).toBeTruthy();
    expect(
      screen.getByText("Answers place a review in one of five stages.")
    ).toBeTruthy();
    expect(screen.getByText("Score stages")).toBeTruthy();

    const section = screen.getByTestId("maturity-section");
    expect(section.className).not.toMatch(/\brounded/);
    expect(section.className).not.toMatch(/\bborder\b/);

    const rangeTrigger = screen.getByRole("button", {
      name: "Adjust score ranges",
    });
    expect(rangeTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(rangeTrigger.getAttribute("aria-controls")).toBe(
      "maturity-score-ranges"
    );
    expect(rangeTrigger.querySelector(".iconify")?.className).toContain(
      "i-lucide:chevron-down"
    );

    const scoringTrigger = screen.getByRole("button", {
      name: "How scoring works",
    });
    expect(scoringTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(scoringTrigger.getAttribute("aria-controls")).toBe(
      "maturity-authoring-scoring-details"
    );
    expect(scoringTrigger.querySelector(".iconify")?.className).toContain(
      "i-lucide:chevron-down"
    );

    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByText("Formula")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Use default ranges" })
    ).toBeNull();

    const route = screen.getByRole("list", {
      name: "Score stages and percentage ranges",
    });
    const spectrum = route.closest("[data-stage-spectrum]");
    expect(spectrum?.className).toContain("rounded-lg");
    expect(spectrum?.className).toContain("shadow-[0_10px_24px");
    expect(route.querySelectorAll("[data-stage-accent]")).toHaveLength(5);
    expect(
      new Set(
        [...route.querySelectorAll("[data-stage-accent]")].map(
          (accent) => accent.className
        )
      ).size
    ).toBe(5);
    const stages = within(route).getAllByRole("listitem");
    expect(stages).toHaveLength(5);
    const ranges = [
      "0 to under 5%",
      "5 to under 25%",
      "25 to under 50%",
      "50 to under 75%",
      "75 to 100%",
    ];
    ranges.forEach((range, index) => {
      expect(stages[index]!.textContent).toContain(range);
    });
    const stageTriggers = within(route).getAllByRole("button", {
      name: /About Stage/,
    });
    expect(stageTriggers).toHaveLength(5);
    expect(
      stageTriggers.every((trigger) =>
        trigger.className.includes("text-[18px]")
      )
    ).toBe(true);
    expect(
      stageTriggers.every((trigger) => trigger.className.includes("min-h-11"))
    ).toBe(true);
    for (const stage of MATURITY_STAGES) {
      expect(screen.queryByText(stage.description)).toBeNull();
    }

    await fireEvent.click(
      screen.getByRole("button", { name: "Test maturity scoring" })
    );
    expect(view.emitted().preview).toHaveLength(1);
  });

  it("opens bare static scoring reference rows without fake review values", async () => {
    await loadEditableStudio();
    render(MaturitySection);

    const trigger = screen.getByRole("button", { name: "How scoring works" });
    await fireEvent.click(trigger);

    expect(trigger.textContent).toContain("How scoring works");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.querySelector(".iconify")?.className).toContain(
      "i-lucide:chevron-up"
    );
    const details = document.getElementById(
      "maturity-authoring-scoring-details"
    );
    expect(details).toBeTruthy();
    expect(details?.className).not.toMatch(/\bborder\b/);
    expect(details?.className).not.toContain("shadow");
    expect(within(details!).getByText("Formula")).toBeTruthy();
    expect(
      within(details!).getByText(
        "points earned ÷ weighted points available = maturity"
      )
    ).toBeTruthy();
    expect(within(details!).getByText("Question weights")).toBeTruthy();
    expect(within(details!).getByText("Medium × 1")).toBeTruthy();
    expect(within(details!).getByText("High × 2")).toBeTruthy();
    expect(within(details!).getByText("Critical × 3")).toBeTruthy();
    expect(within(details!).getByText("Answer rules")).toBeTruthy();
    expect(
      within(details!).getByText("Checklist items share question weight")
    ).toBeTruthy();
    expect(
      within(details!).getByText(
        "Unanswered earns 0; its weight stays available"
      )
    ).toBeTruthy();
    expect(within(details!).getByText("N/A · excluded, not × 0")).toBeTruthy();
    expect(details?.querySelectorAll("[data-scoring-rule]")).toHaveLength(3);
    expect(screen.queryByText("Current question mix")).toBeNull();
    expect(screen.queryByText(/coverage/i)).toBeNull();
    expect(
      screen.queryByText(/points earned:|weighted points available:/i)
    ).toBeNull();
    expect(screen.queryByText("Score stage", { exact: true })).toBeNull();
  });

  it("opens four proportional seam sliders with chips and one selected editor", async () => {
    await loadEditableStudio();
    render(MaturitySection);

    const trigger = await openScoreRanges();
    expect(trigger.textContent).toContain("Adjust score ranges");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.querySelector(".iconify")?.className).toContain(
      "i-lucide:chevron-up"
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(4);
    expect(screen.getByTestId("maturity-section").textContent).not.toMatch(
      /boundary between/i
    );
    const first = sliders[0]!;
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(first.getAttribute("aria-label")).toBe("Stage 2 Ad-hoc starts at");
    expect(first.getAttribute("aria-valuenow")).toBe("5");
    expect(first.getAttribute("aria-valuemin")).toBe("5");
    expect(first.getAttribute("aria-valuemax")).toBe("20");
    expect(first.getAttribute("aria-valuetext")).toBe(
      "5 percent. Ad-hoc starts here; Not implemented ends below it."
    );

    const rail = screen.getByTestId("maturity-score-band-rail");
    expect(rail.querySelectorAll("[data-score-band]")).toHaveLength(5);
    expect(
      [...rail.querySelectorAll<HTMLElement>("[data-score-band]")].map(
        (band) => band.style.flexBasis
      )
    ).toEqual(["5%", "20%", "25%", "25%", "25%"]);
    expect(
      screen.getByText("Drag a handle. Select it to type an exact percentage.")
    ).toBeTruthy();
    for (const chip of ["5%", "25%", "50%", "75%"]) {
      expect(screen.getByText(chip)).toBeTruthy();
    }

    expect(screen.queryByRole("spinbutton")).toBeNull();
    await fireEvent.focus(first);
    expect(first.getAttribute("data-selected")).toBe("true");
    expect(first.querySelector(".i-lucide\\:grip-vertical")).toBeTruthy();
    expect(screen.queryByText(/01→02/)).toBeNull();
    expect(
      screen
        .getByTestId("maturity-score-spectrum")
        .querySelectorAll("[data-stage-accent]")
    ).toHaveLength(0);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(
      screen.getByRole("spinbutton", {
        name: "Ad-hoc starts at",
      })
    ).toBeTruthy();
    const spectrum = screen.getByTestId("maturity-score-spectrum");
    expect(within(spectrum).getAllByRole("slider")).toHaveLength(4);
    expect(within(spectrum).getAllByRole("spinbutton")).toHaveLength(1);
    expect(document.querySelector("[data-detached-boundary-grid]")).toBeNull();
    expect(
      within(spectrum).getAllByRole("button", { name: /About Stage/ })
    ).toHaveLength(5);
  });

  it("supports every boundary keyboard command and pauses live announcements", async () => {
    const studio = await loadEditableStudio();
    studio.withMaturityMutation((definition) => ({
      ...definition,
      thresholds: [10, 30, 55, 80] as const,
    }));
    render(MaturitySection);
    await openScoreRanges();
    vi.useFakeTimers();

    const first = scoreRangeSlider(0);
    for (const [key, expected] of [
      ["ArrowLeft", 9],
      ["ArrowDown", 8],
      ["ArrowRight", 9],
      ["ArrowUp", 10],
      ["PageDown", 5],
      ["PageUp", 10],
      ["Home", 5],
      ["End", 25],
    ] as const) {
      await fireEvent.keyDown(first, { key });
      expect(studio.maturityDefinition.value?.thresholds[0]).toBe(expected);
    }

    const live = screen.getByRole("status");
    expect(live.textContent).toBe("");
    await vi.advanceTimersByTimeAsync(350);
    expect(live.textContent).toBe(
      "Ad-hoc now starts at 25 percent. Not implemented is 0 to under 25 percent; Ad-hoc is 25 to under 30 percent."
    );
  });

  it("updates pointer geometry transiently and commits once on pointer end", async () => {
    const studio = await loadEditableStudio();
    render(MaturitySection);
    await openScoreRanges();

    const state =
      await import("~/composables/templates/studio/useTemplateStudio-state");
    const generation = state.mutationGeneration.value;
    const first = scoreRangeSlider(0);
    const rail = screen.getByTestId("maturity-score-band-rail");
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 1000,
      top: 0,
      bottom: 12,
      width: 1000,
      height: 12,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const capture = vi.fn();
    const release = vi.fn();
    Object.defineProperty(first, "setPointerCapture", { value: capture });
    Object.defineProperty(first, "releasePointerCapture", { value: release });

    await fireEvent.pointerDown(first, { clientX: 50, pointerId: 7 });
    await fireEvent.pointerMove(first, { clientX: 100, pointerId: 7 });

    expect(capture).toHaveBeenCalledWith(7);
    expectVisibleRange("0 to under 10%");
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(5);
    expect(state.mutationGeneration.value).toBe(generation);
    expect(screen.getByRole("status").textContent).toBe("");

    await fireEvent.pointerUp(first, { clientX: 100, pointerId: 7 });
    expect(release).toHaveBeenCalledWith(7);
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(10);
    expect(state.mutationGeneration.value).toBe(generation + 1);
    expect(screen.getByRole("status").textContent).toBe(
      "Ad-hoc now starts at 10 percent. Not implemented is 0 to under 10 percent; Ad-hoc is 10 to under 25 percent."
    );
  });

  it("commits valid numeric text, preserves invalid text, and cancels to the handle", async () => {
    const studio = await loadEditableStudio();
    render(MaturitySection);
    await openScoreRanges();

    const first = scoreRangeSlider(0);
    await fireEvent.focus(first);
    await fireEvent.keyDown(first, { key: "Enter" });
    const input = screen.getByRole("spinbutton", {
      name: "Ad-hoc starts at",
    });
    expect(document.activeElement).toBe(input);

    await fireEvent.update(input, "10");
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(10);
    expect(screen.getByRole("status").textContent).toContain(
      "Ad-hoc now starts at 10 percent"
    );

    await fireEvent.update(input, "24");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect((input as HTMLInputElement).value).toBe("24");
    expect(
      screen.getByText("Choose 5% to 20% for where Ad-hoc starts.")
    ).toBeTruthy();
    await fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).toBe(first);
    expect((input as HTMLInputElement).value).toBe("10");
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(10);

    const second = scoreRangeSlider(1);
    await fireEvent.focus(second);
    const secondInput = screen.getByRole("spinbutton", {
      name: "Defined starts at",
    });
    await fireEvent.update(secondInput, "32");
    await fireEvent.blur(secondInput);
    expect(studio.maturityDefinition.value?.thresholds[1]).toBe(32);
  });

  it("prevents crossing and updates legal limits from neighboring boundaries", async () => {
    const studio = await loadEditableStudio();
    render(MaturitySection);
    await openScoreRanges();

    const first = scoreRangeSlider(0);
    await fireEvent.keyDown(first, { key: "End" });
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(20);
    expect(first.getAttribute("aria-valuemax")).toBe("20");

    const second = scoreRangeSlider(1);
    expect(second.getAttribute("aria-valuemin")).toBe("25");
    expect(second.getAttribute("aria-valuemax")).toBe("45");
    await fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(studio.maturityDefinition.value?.thresholds[0]).toBe(20);
    expectVisibleRange("20 to under 25%");
  });

  it("leaves invalid stored ranges visible and disables dragging until repair", async () => {
    const studio = await loadEditableStudio();
    studio.withMaturityMutation((definition) => ({
      ...definition,
      thresholds: [10, 12, 55, 80] as const,
    }));
    render(MaturitySection);
    await openScoreRanges();

    expectVisibleRange("10 to under 12%");
    const first = scoreRangeSlider(0);
    const second = scoreRangeSlider(1);
    expect(first.getAttribute("aria-invalid")).toBe("true");
    expect(first.getAttribute("aria-disabled")).toBe("true");
    expect(second.getAttribute("aria-invalid")).toBe("true");
    expect(second.getAttribute("aria-disabled")).toBe("true");

    await fireEvent.pointerDown(second, { clientX: 200, pointerId: 3 });
    await fireEvent.pointerMove(second, { clientX: 300, pointerId: 3 });
    await fireEvent.pointerUp(second, { clientX: 300, pointerId: 3 });
    expect(studio.maturityDefinition.value?.thresholds).toEqual([
      10, 12, 55, 80,
    ]);

    await fireEvent.focus(second);
    const input = screen.getByRole("spinbutton", {
      name: "Defined starts at",
    });
    expect((input as HTMLInputElement).value).toBe("12");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await fireEvent.update(input, "15");
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(studio.maturityDefinition.value?.thresholds).toEqual([
      10, 15, 55, 80,
    ]);
    expect(scoreRangeSlider(0).getAttribute("aria-invalid")).toBe("false");
    expect(scoreRangeSlider(1).getAttribute("aria-disabled")).toBeNull();
  });

  it("resets all ranges atomically, announces it, and disables the default action", async () => {
    const studio = await loadEditableStudio();
    render(MaturitySection);
    await openScoreRanges();

    const reset = screen.getByRole("button", { name: "Use default ranges" });
    expect(reset.hasAttribute("disabled")).toBe(true);
    await fireEvent.keyDown(scoreRangeSlider(0), { key: "ArrowRight" });
    expect(reset.hasAttribute("disabled")).toBe(false);

    const state =
      await import("~/composables/templates/studio/useTemplateStudio-state");
    const generation = state.mutationGeneration.value;
    await fireEvent.click(reset);
    expect(studio.maturityDefinition.value?.thresholds).toEqual([
      5, 25, 50, 75,
    ]);
    expect(state.mutationGeneration.value).toBe(generation + 1);
    expect(reset.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Default score ranges restored: 5, 25, 50, and 75 percent."
    );
  });

  it("stacks stage seams with full-width controls at narrow widths without overflow utilities", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    await loadEditableStudio();
    render(MaturitySection);
    await openScoreRanges();

    const spectrum = screen.getByTestId("maturity-score-spectrum");
    expect(screen.getAllByRole("slider")).toHaveLength(4);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(4);
    expect(screen.getAllByText("Ad-hoc starts at").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Defined starts at").length).toBeGreaterThan(0);
    for (const slider of screen.getAllByRole("slider")) {
      expect(slider.className).toContain("w-full");
    }
    expect(spectrum.className).not.toContain("overflow-x");
    expect(spectrum.querySelector(".grid-cols-4")).toBeNull();
  });

  it("derives honest labels from custom boundaries without subtracting one", async () => {
    const studio = await loadEditableStudio();
    studio.withMaturityMutation((definition) => ({
      ...definition,
      thresholds: [10, 30, 55, 80] as const,
    }));
    render(MaturitySection);

    expectVisibleRange("0 to under 10%");
    expectVisibleRange("10 to under 30%");
    expect(screen.queryByText("0 to 9%")).toBeNull();
  });

  it("keeps legacy custom weighting honest without exposing share controls", async () => {
    const studio = await loadEditableStudio();
    studio.withMaturityMutation((definition) => ({
      ...definition,
      allocations: {
        ...definition.allocations,
        "q-2": { mode: "custom", shares: { "c-1": 60, "c-2": 40 } },
      },
    }));
    render(MaturitySection);

    expect(screen.getByText(/retains custom practice weighting/i)).toBeTruthy();
    expect(screen.queryByText(/custom shares/i)).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();

    await fireEvent.click(
      screen.getByRole("button", { name: /use equal weighting/i })
    );
    expect(studio.maturityDefinition.value?.allocations["q-2"]).toEqual({
      mode: "equal",
    });
  });
});
