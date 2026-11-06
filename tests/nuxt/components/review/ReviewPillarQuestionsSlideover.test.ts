import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/vue";
import ReviewPillarQuestionsSlideover from "~/components/review/ReviewPillarQuestionsSlideover.vue";
import { indexStagePathQuestions } from "~/services/maturity/stagePath";
import { resultEntry, stagePathWorkspace } from "../maturity/fixtures";

const slideoverStub = {
  props: ["open", "title"],
  template: `<div v-if="open" role="dialog" :aria-label="title"><h2>{{ title }}</h2><slot name="body" /><slot name="footer" /></div>`,
};
const stageStub = {
  props: ["stage"],
  template: `<button :aria-label="'Stage ' + stage">Stage {{ stage }}</button>`,
};

afterEach(cleanup);

describe("ReviewPillarQuestionsSlideover", () => {
  it("reveals checklist evidence from the question meter without opportunity forecasts", async () => {
    const workspace = stagePathWorkspace();
    const entry = resultEntry(workspace);
    const pillar = workspace.pillars.find(
      (candidate) => candidate.id === "P-B"
    )!;
    render(ReviewPillarQuestionsSlideover, {
      props: {
        open: true,
        workspace,
        entry,
        pillarId: pillar.id,
        pillarName: pillar.name,
        subjectId: workspace.reviewSubject.id,
        questions: indexStagePathQuestions(workspace.pillars),
      },
      global: {
        stubs: {
          USlideover: slideoverStub,
          MaturityStagePopover: stageStub,
        },
      },
    });

    const dialog = screen.getByRole("dialog", {
      name: `${pillar.name} maturity`,
    });
    expect(within(dialog).getByText("Pillar result")).toBeDefined();
    expect(
      within(dialog).getByText("How each question contributes")
    ).toBeDefined();
    expect(within(dialog).queryByText("Opportunity")).toBeNull();

    const meter = within(dialog).getByRole("button", {
      name: /View 2 checklist items for Text of Q3/,
    });
    expect(meter.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(meter);
    expect(meter.getAttribute("aria-expanded")).toBe("true");

    const evidenceId = meter.getAttribute("aria-controls");
    const evidence = document.getElementById(evidenceId!);
    expect(evidence).not.toBeNull();
    expect(evidence!.textContent).toContain("1 met · 1 need follow-up");
    expect(evidence!.textContent).toContain("Q3-P1");
    expect(evidence!.textContent).toContain("Met");
    expect(evidence!.textContent).toContain("Needs follow-up");
  });
});
