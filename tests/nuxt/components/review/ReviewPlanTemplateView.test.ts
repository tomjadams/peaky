import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import ReviewPlanTemplateView from "~/components/review/ReviewPlanTemplateView.vue";
import type { ReviewWorkspace } from "~/models/workspace";
import { workspaceToReviewContext } from "~/composables/reviews/useReviewPlanData";
import {
  projectSelectablePractices,
  type SelectablePractice,
} from "~/services/handoff/projection";
import { resultEntry, stagePathWorkspace } from "../maturity/fixtures";

const moreInfo = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("~/ui/useMoreInfoPanel", () => ({
  useMoreInfoPanel: () => ({ openMoreInfoPanel: moreInfo.open }),
}));

const routeState = vi.hoisted(() => ({
  path: "/teams/team-1/reviews/review-1/plan",
  query: {} as Record<string, string | undefined>,
  replace: vi.fn(),
  push: vi.fn(),
  resolve: vi.fn(() => ({ fullPath: "/assessment#question" })),
}));
mockNuxtImport("useRoute", () => () => routeState);
mockNuxtImport("useRouter", () => () => ({
  replace: routeState.replace,
  push: routeState.push,
  resolve: routeState.resolve,
}));

const nuxtLinkStub = {
  props: ["to"],
  template: `<a :href="JSON.stringify(to)"><slot /></a>`,
};
const tooltipStub = {
  props: ["text"],
  template: `<span><slot /><span role="tooltip">{{ text }}</span></span>`,
};
const slideoverStub = {
  props: ["open", "title"],
  emits: ["update:open"],
  template: `<div role="dialog" :aria-label="title"><slot name="body" /><slot name="footer" /></div>`,
};

function selectableFor(workspace: ReviewWorkspace) {
  return new Map(
    projectSelectablePractices(workspaceToReviewContext(workspace, "team")).map(
      (practice) => [practice.entityId, practice]
    )
  );
}

function renderView(
  workspace: ReviewWorkspace = stagePathWorkspace(),
  overrides: {
    selectedIds?: Set<string>;
    ownedPracticeIds?: Set<string>;
    excludeOwnedFromSelectable?: boolean;
    selectionLimitReached?: boolean;
    selectionWriteAvailable?: boolean;
  } = {}
) {
  const selectablePractices = selectableFor(workspace);
  if (overrides.excludeOwnedFromSelectable) {
    for (const entityId of overrides.ownedPracticeIds ?? []) {
      selectablePractices.delete(entityId);
    }
  }
  return render(ReviewPlanTemplateView, {
    props: {
      workspace,
      entry: resultEntry(workspace),
      assessmentRouteName: "team-review-assessment",
      assessmentParams: { teamId: "team-1", reviewId: "review-1" },
      selectablePractices,
      selectedIds: overrides.selectedIds ?? new Set<string>(),
      previouslyHandedOffIds: overrides.ownedPracticeIds ?? new Set<string>(),
      selectionLimitReached: overrides.selectionLimitReached ?? false,
      selectionError: "",
      selectionErrorEntityId: null,
      selectionViolations: [],
      selectionWriteAvailable: overrides.selectionWriteAvailable ?? true,
      selectionUnavailableReason: "Preparing local changes.",
    },
    slots: {
      handoff: `<div role="region" aria-label="Handoff test composer">Composer</div>`,
    },
    global: {
      stubs: {
        NuxtLink: nuxtLinkStub,
        UTooltip: tooltipStub,
        USlideover: slideoverStub,
        InlineMarkdown: {
          props: ["text"],
          template: `<span>{{ text }}</span>`,
        },
      },
    },
  });
}

beforeEach(() => {
  moreInfo.open.mockReset();
  routeState.query = {};
  routeState.replace.mockReset().mockResolvedValue(undefined);
  routeState.push.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("ReviewPlanTemplateView", () => {
  it("leads with a severity-first work queue without repeating maturity", () => {
    renderView();

    expect(
      screen.getByRole("heading", { name: "Needs attention" })
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Critical" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "High" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Medium" })).toBeDefined();
    expect(
      screen.queryByRole("region", { name: "Maturity context" })
    ).toBeNull();
    expect(screen.queryByText("Explore maturity stages")).toBeNull();
    expect(screen.queryByRole("region", { name: /stage gaps/i })).toBeNull();
  });

  it("selects an explicit follow-up from the full practice row", async () => {
    const view = renderView();
    const toggle = screen.getByRole("checkbox", {
      name: /Add "Text of Q2" to handoff/,
    });
    const row = toggle.closest("li")!;

    expect(row.textContent).toContain("Recorded answer: No");
    expect(row.textContent).toContain("Add to handoff");
    expect(row.textContent).not.toContain("Placement:");
    await fireEvent.click(toggle);

    const events = view.emitted().toggle as [SelectablePractice, boolean][];
    expect(events[0]![0].reference.questionId).toBe("Q2");
    expect(events[0]![1]).toBe(true);
  });

  it("keeps removed practices from the active handoff available", () => {
    const workspace = stagePathWorkspace();
    const practice = selectableFor(workspace).values().next().value!;
    renderView(workspace, {
      ownedPracticeIds: new Set([practice.entityId]),
    });

    expect(
      screen.getByRole("checkbox", {
        name: (name) => name.includes(`Add "${practice.title}" to handoff`),
      })
    ).toBeDefined();
  });

  it("keeps prior handoffs out of the available queue until filtered", async () => {
    const workspace = stagePathWorkspace();
    const ownedId = selectableFor(workspace).keys().next().value!;
    renderView(workspace, {
      ownedPracticeIds: new Set([ownedId]),
      excludeOwnedFromSelectable: true,
    });

    expect(
      screen.queryByLabelText(
        "Handed off previously. Still needs evidence in Assessment."
      )
    ).toBeNull();
    await fireEvent.click(
      screen.getByRole("radio", { name: "Handed off previously" })
    );
    expect(
      screen.getByLabelText(
        "Handed off previously. Still needs evidence in Assessment."
      )
    ).toBeDefined();
  });

  it("shows unanswered evidence once per question and never as selectable", () => {
    renderView();
    const unanswered = screen
      .getByText(/1 question still needs an answer/)
      .closest("section") as HTMLElement;

    expect(within(unanswered).getByText("Text of Q5")).toBeDefined();
    expect(
      within(unanswered).getByRole("link", { name: "Open question" })
    ).toBeDefined();
    expect(within(unanswered).queryByRole("checkbox")).toBeNull();
    expect(unanswered.textContent).toContain("1 question");
  });

  it("opens question guidance without leaving Follow-ups", async () => {
    const workspace = stagePathWorkspace();
    const question = workspace.pillars
      .flatMap((pillar) => pillar.questions)
      .find((candidate) => candidate.id === "Q4")!;
    question.importance = "Rollback capability limits failed releases.";
    renderView(workspace);

    const questionGroup = screen.getByText("Text of Q4").closest("article")!;
    await fireEvent.click(
      within(questionGroup).getByRole("button", { name: "Question details" })
    );
    expect(moreInfo.open).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Text of Q4",
        whyImportant: "Rollback capability limits failed releases.",
      })
    );
  });

  it("filters the whole queue by pillar with a visible count", async () => {
    renderView();
    await fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("radio", {
        name: "Pillar P-B",
      })
    );

    expect(screen.queryByText("Text of Q2")).toBeNull();
    expect(screen.getByText("Q3-P2")).toBeDefined();
    expect(
      screen.getByText(/Showing 1 of 3 practices needing follow-up/)
    ).toBeDefined();
  });

  it("switches between Needs attention and Handoff on narrow layouts", async () => {
    renderView();
    const tabs = screen.getByRole("tablist", { name: "Follow-ups view" });
    const attention = within(tabs).getByRole("tab", {
      name: "Needs attention",
    });
    const handoff = within(tabs).getByRole("tab", { name: "Handoff 0" });

    expect(attention.getAttribute("aria-selected")).toBe("true");
    await fireEvent.click(handoff);
    expect(handoff.getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("region", { name: "Handoff test composer" })
    ).toBeDefined();
  });

  it("restores the narrow Handoff view from return context", () => {
    routeState.query = { followUpView: "handoff" };
    renderView();
    expect(
      screen
        .getByRole("tab", { name: "Handoff 0" })
        .getAttribute("aria-selected")
    ).toBe("true");
  });

  it("records reader place before opening question details", async () => {
    renderView();
    const questionGroup = screen.getByText("Text of Q2").closest("article")!;
    await fireEvent.click(
      within(questionGroup).getByRole("button", { name: "Question details" })
    );

    expect(routeState.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          templateRevisionId: "rev-1",
          followUpQuestionId: "Q2",
        }),
        hash: "#follow-up-Q2",
      })
    );
    expect(moreInfo.open).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Open question in assessment",
        }),
      })
    );
  });

  it("keeps blocked selection focusable and visibly disabled", async () => {
    const view = renderView(stagePathWorkspace(), {
      selectionLimitReached: true,
    });
    const toggle = screen.getByRole("checkbox", {
      name: /Add "Text of Q2" to handoff/,
    });

    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    expect(toggle.className).toContain("cursor-not-allowed");
    await fireEvent.click(toggle);
    expect(view.emitted().toggle ?? []).toHaveLength(0);
  });
});
