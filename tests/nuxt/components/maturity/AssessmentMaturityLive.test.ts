import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import AssessmentMaturityLive from "~/components/maturity/AssessmentMaturityLive.vue";
import { resultEntry, stagePathWorkspace } from "./fixtures";

const stageStub = {
  props: ["stage"],
  template: `<button :aria-label="'Stage ' + stage">Stage {{ stage }}</button>`,
};
const popoverStub = {
  template: `<span><slot /><div role="dialog"><slot name="content" /></div></span>`,
};

afterEach(cleanup);

describe("AssessmentMaturityLive", () => {
  it("keeps the live result compact and the scoring rule on demand", () => {
    render(AssessmentMaturityLive, {
      props: { entry: resultEntry(stagePathWorkspace()) },
      global: {
        stubs: {
          MaturityStagePopover: stageStub,
          UPopover: popoverStub,
        },
      },
    });

    const region = screen.getByRole("region", {
      name: "Live maturity calculation",
    });
    expect(region.textContent).toContain("Maturity");
    expect(region.textContent).toContain("25%");
    expect(screen.getByRole("button", { name: "Stage 2" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "How live maturity is calculated" })
    ).toBeDefined();
    const explanation = screen.getByRole("dialog");
    expect(explanation.textContent).toContain(
      "Template authors set it. Higher severity gives a question more points."
    );
    expect(explanation.textContent).toContain(
      "For a checklist item, it removes only that item's points."
    );
  });
});
