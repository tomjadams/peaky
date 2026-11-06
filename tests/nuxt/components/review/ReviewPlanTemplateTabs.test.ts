import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import ReviewPlanTemplateTabs from "~/components/review/ReviewPlanTemplateTabs.vue";
import { buildWorkspace, type ReviewWorkspace } from "~/models/workspace";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import { makeDefinition } from "../../../unit/services/maturity/acceptanceVectors";
import {
  noApplicableQuestions,
  wholeQuestionAssociations,
  yesNo,
} from "../../../unit/services/maturity/calculationFixtures";
import {
  makeAnswers,
  makePillars,
  makeRevision,
  makeWorkspaceOptions,
} from "../../../unit/services/maturity/workspaceFixtures";
import {
  multiRevisionWorkspace,
  stagePathWorkspace,
} from "../maturity/fixtures";
import type { VectorQuestion } from "../../../unit/services/maturity/acceptanceVectors";

const selectMenuStub = {
  props: ["modelValue", "items"],
  emits: ["update:modelValue"],
  template: `<select aria-label="Choose template revision" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value" :data-summary="item.summary">{{ item.label }}</option></select>`,
};

const definitionJsonFor = (questions: readonly VectorQuestion[]): string =>
  serializeMaturityDefinition(
    makeDefinition(questions, wholeQuestionAssociations(questions))
  );

function mixedWorkspace(): ReviewWorkspace {
  const questions = [yesNo("A-Q1", "P-A", "medium", "yes")];
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, definitionJsonFor(questions)),
        makeRevision("rev-2", 1, definitionJsonFor(noApplicableQuestions)),
      ],
      pillars: [
        ...makePillars("rev-1", questions),
        ...makePillars("rev-2", noApplicableQuestions),
      ],
      answers: [
        ...makeAnswers(questions),
        ...makeAnswers(noApplicableQuestions),
      ],
    })
  );
}

const renderSelector = (workspace: ReviewWorkspace, modelValue: string) =>
  render(ReviewPlanTemplateTabs, {
    props: { workspace, modelValue },
    global: { stubs: { USelectMenu: selectMenuStub } },
  });

describe("ReviewPlanTemplateTabs", () => {
  afterEach(cleanup);

  it("shows every pinned revision as a visible desktop tab", () => {
    renderSelector(multiRevisionWorkspace(), "rev-1");

    expect(
      screen.getByRole("group", { name: "Selected template" })
    ).toBeDefined();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.textContent).toContain("Template rev-1");
    expect(tabs[0]!.textContent).toContain("Revision 1");
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.textContent).toContain("Template rev-2");
  });

  it("emits the exact opaque revision selected", async () => {
    const view = renderSelector(multiRevisionWorkspace(), "rev-1");
    await fireEvent.click(screen.getAllByRole("tab")[1]!);
    expect(view.emitted()["update:modelValue"]).toEqual([["rev-2"]]);
  });

  it("shows explicit non-result copy without inventing zero percent", () => {
    renderSelector(mixedWorkspace(), "rev-2");
    const options = screen.getAllByRole("option");
    expect(options[1]!.dataset.summary).toContain("No result yet");
    expect(options[1]!.dataset.summary).not.toContain("0%");
  });

  it("uses static identity when one revision is pinned", () => {
    renderSelector(stagePathWorkspace(), "rev-1");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Template rev-1 · revision 1")).toBeDefined();
    expect(screen.getByText("25%")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "About Stage 2, Ad-hoc" })
    ).toBeDefined();
    expect(document.body.textContent).toContain(
      "Provisional until all 5 questions are answered"
    );
  });

  it("never presents a combined result", () => {
    renderSelector(multiRevisionWorkspace(), "rev-1");
    expect(document.body.textContent).not.toMatch(/combined|overall maturity/i);
  });
});
