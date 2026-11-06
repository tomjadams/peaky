import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { computed, ref } from "vue";
import ReviewPlanPage from "~/components/review/ReviewPlanPage.vue";
import { buildImprovementPlan } from "~/services/review/ImprovementPlanProjection";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import { buildWorkspace, type ReviewWorkspace } from "~/models/workspace";
import {
  associate,
  makeDefinition,
} from "../../../unit/services/maturity/acceptanceVectors";
import { yesNo } from "../../../unit/services/maturity/calculationFixtures";
import {
  makeAnswers,
  makePillars,
  makeRevision,
  makeWorkspaceOptions,
} from "../../../unit/services/maturity/workspaceFixtures";
import {
  advisorOverride,
  multiRevisionWorkspace,
  noResultWorkspace,
  stagePathWorkspace,
} from "../maturity/fixtures";

const state = vi.hoisted(() => ({
  workspace: null as ReviewWorkspace | null,
  loading: false,
  error: null as Error | null,
  rows: [] as never[],
  localWritesReady: true,
  localWriteError: null as Error | null,
}));

const writes = vi.hoisted(() => ({
  select: vi.fn().mockResolvedValue([]),
  deselect: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/composables/reviews/useReviewPlanData", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("~/composables/reviews/useReviewPlanData")
    >();
  return {
    ...actual,
    useReviewPlanData: () => ({
      plan: computed(() =>
        state.workspace
          ? buildImprovementPlan(
              actual.workspaceToReviewContext(state.workspace, "team")
            )
          : null
      ),
      workspace: computed(() => state.workspace),
      loading: computed(() => state.loading),
      error: computed(() => state.error),
      localWritesReady: computed(() => state.localWritesReady),
      localWriteError: computed(() => state.localWriteError),
      refresh: vi.fn(),
    }),
  };
});

vi.mock("~/composables/reviews/useReviewData", () => ({
  useReviewData: () => ({ review: ref({ name: "Q4 2026 Review" }) }),
}));

vi.mock("~/composables/handoff/useHandoffData", () => ({
  useHandoffData: () => ({
    allRows: computed(() => state.rows),
    rows: computed(() => state.rows),
    ownedPracticeIds: computed(() => new Set<string>()),
    handoffs: ref([]),
    activeHandoff: ref(null),
    analytics: ref([]),
    history: ref([]),
    loading: ref(false),
    refresh: vi.fn(),
  }),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: ref({ id: "actor-1", name: "Advisor One", roles: [] }),
  }),
}));

vi.mock("~/services/handoff/handoffWrite", () => ({
  selectHandoffPractice: writes.select,
  deselectHandoffPractice: writes.deselect,
  setHandoffPracticeRationale: vi.fn().mockResolvedValue([]),
  reorderHandoffPractice: vi.fn().mockResolvedValue([]),
}));

const selectStub = {
  inheritAttrs: false,
  props: ["modelValue", "items", "ariaLabel"],
  emits: ["update:modelValue"],
  template: `<select :aria-label="ariaLabel" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="String(item.value)" :value="item.value">{{ item.label }}</option></select>`,
};

function renderPage(workspace: ReviewWorkspace) {
  state.workspace = workspace;
  return render(ReviewPlanPage, {
    props: {
      reviewId: "review-1",
      subjectType: "team",
      assessmentRouteName: "team-review-assessment",
      assessmentParams: { teamId: "team-1", reviewId: "review-1" },
      reviewRouteName: "team-review-details",
      cssPrefix: "review-plan",
    },
    global: {
      stubs: {
        NuxtLink: {
          props: ["to"],
          template: `<a :href="JSON.stringify(to)"><slot /></a>`,
        },
        USelect: selectStub,
        USelectMenu: selectStub,
        UTooltip: { template: `<span><slot /></span>` },
        HandoffComposer: {
          template: `<section aria-label="Handoff">Composer</section>`,
        },
      },
    },
  });
}

function mixedResultWorkspace(): ReviewWorkspace {
  const questionsA = [yesNo("A-Q1", "P-A", "medium", "no")];
  const questionsB = [yesNo("B-Q1", "P-B", "high", "no")];
  const definitionA = makeDefinition(
    questionsA,
    associate([{ id: "A-Q1", stage: 1 }])
  );
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, serializeMaturityDefinition(definitionA)),
        makeRevision("rev-2", 1, null),
      ],
      pillars: [
        ...makePillars("rev-1", questionsA),
        ...makePillars("rev-2", questionsB),
      ],
      answers: [...makeAnswers(questionsA), ...makeAnswers(questionsB)],
    })
  );
}

describe("ReviewPlanPage route composition", () => {
  beforeEach(() => {
    state.workspace = null;
    state.loading = false;
    state.error = null;
    state.rows = [];
    state.localWritesReady = true;
    state.localWriteError = null;
    writes.select.mockClear();
    writes.deselect.mockClear();
  });

  afterEach(cleanup);

  it("renders a template-scoped queue beside the in-page composer", () => {
    const rendered = renderPage(multiRevisionWorkspace());

    expect(
      screen.getByRole("heading", { name: "Q4 2026 Review", level: 2 })
    ).toBeDefined();
    expect(rendered.container.querySelector("main")).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "Choose template revision" })
    ).toBeDefined();
    expect(screen.getByLabelText("Maturity estimate")).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Needs attention" })
    ).toBeDefined();
    expect(screen.getByRole("region", { name: "Handoff" })).toBeDefined();
    expect(screen.queryByText("Explore maturity stages")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Continue assessment/i })
    ).toBeNull();
  });

  it("keeps the header focused on choosing and preparing follow-up work", () => {
    renderPage(stagePathWorkspace());
    expect(
      screen.getByText(
        "Choose areas needing attention, then prepare the work for handoff."
      )
    ).toBeDefined();
    expect(screen.queryByText(/\d+ items need attention/i)).toBeNull();
  });

  it("switches revisions through the selector and scopes handoff selection", async () => {
    renderPage(multiRevisionWorkspace());
    await fireEvent.update(
      screen.getByRole("combobox", { name: "Choose template revision" }),
      "rev-2"
    );

    expect(screen.getByText("Text of B-Q1")).toBeDefined();
    expect(screen.queryByText("Text of A-Q1")).toBeNull();
    expect(screen.queryByRole("link", { name: /Text of B-Q1/ })).toBeNull();
    await fireEvent.click(
      screen.getByRole("checkbox", { name: /Add "Text of B-Q1" to handoff/ })
    );
    expect(writes.select).toHaveBeenCalledWith(
      expect.objectContaining({
        practice: expect.objectContaining({
          reference: expect.objectContaining({ templateRevisionId: "rev-2" }),
        }),
      })
    );
  });

  it("keeps a no-result sibling's fallback queue and composer separate", async () => {
    renderPage(mixedResultWorkspace());
    await fireEvent.update(
      screen.getByRole("combobox", { name: "Choose template revision" }),
      "rev-2"
    );

    expect(
      screen.getByRole("heading", { name: /no maturity definition/i })
    ).toBeDefined();
    const queue = screen.getByRole("heading", { name: "Needs attention" })
      .parentElement as HTMLElement;
    expect(queue.textContent).toContain("Text of B-Q1");
    expect(queue.textContent).not.toContain("Text of A-Q1");
    expect(screen.getByRole("region", { name: "Handoff" })).toBeDefined();
  });

  it("offers the exact assessment action when no result exists yet", () => {
    renderPage(noResultWorkspace());
    const action = screen.getByRole("link", { name: /Answer the assessment/i });
    expect(action.getAttribute("href")).toContain("templateRevisionId");
  });

  it("uses the same fallback without a maturity collection", () => {
    renderPage({ ...stagePathWorkspace(), maturity: [] });
    expect(
      screen.getByRole("heading", { name: "Needs attention" })
    ).toBeDefined();
    expect(screen.getByRole("region", { name: "Handoff" })).toBeDefined();
    expect(screen.queryByText(/stage groups/i)).toBeNull();
  });

  it("renders static revision identity for one template", () => {
    renderPage(stagePathWorkspace());
    expect(
      screen.queryByRole("combobox", { name: /template revision/i })
    ).toBeNull();
    expect(screen.getByText("Template rev-1 · revision 1")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "About Stage 2, Ad-hoc" })
    ).toBeDefined();
  });

  it("preserves the effective Advisor-reviewed context", () => {
    renderPage(stagePathWorkspace([advisorOverride]));
    const context = screen.getByLabelText("Maturity estimate");
    expect(context.textContent).toContain("75%");
    expect(
      screen.getByRole("button", { name: "About Stage 4, Measured" })
    ).toBeDefined();
    expect(context.textContent).toContain("Advisor reviewed");
  });

  it("keeps loading and error states explicit", () => {
    state.loading = true;
    renderPage(stagePathWorkspace());
    expect(screen.getByText("Loading follow-ups...")).toBeDefined();

    cleanup();
    state.loading = false;
    state.error = new Error("failed");
    renderPage(stagePathWorkspace());
    expect(screen.getByRole("alert").textContent).toContain(
      "Failed to load follow-ups"
    );
  });
});
