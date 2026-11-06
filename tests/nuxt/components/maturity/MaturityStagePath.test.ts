/**
 * Interactive maturity stage path (maturity-score/REQ-013, REQ-014;
 * AC-036 through AC-038, AC-056 through AC-061).
 *
 * The path shows all five canonical stages; selecting one reveals its
 * associated practices — met/unmet for earlier stages, unmet gaps for the
 * current stage, and non-prescriptive guidance for future stages — announced
 * through a live region with focus moved to the revealed content.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { nextTick } from "vue";
import MaturityStagePath from "~/components/maturity/MaturityStagePath.vue";
import { decodeMaturityDefinition } from "~/services/maturity/persistence";
import { indexStagePathQuestions } from "~/services/maturity/stagePath";
import { resultEntry, stagePathWorkspace } from "./fixtures";

const workspace = stagePathWorkspace();
const entry = resultEntry(workspace);
const questions = indexStagePathQuestions(
  workspace.pillars.filter((pillar) => pillar.templateRevisionId === "rev-1")
);
const definition = stagePathWorkspaceDefinition();

function stagePathWorkspaceDefinition() {
  const revision = workspace.templateRevisions[0]!;
  const decoded = decodeMaturityDefinition(revision.maturityDefinition);
  if (!decoded) throw new Error("fixture must carry a definition");
  return decoded;
}

const nuxtLinkStub = {
  props: ["to"],
  template: `<a :href="JSON.stringify(to)"><slot /></a>`,
};

const selectStub = {
  inheritAttrs: false,
  props: ["modelValue", "items", "ariaLabel"],
  emits: ["update:modelValue"],
  template: `<select :aria-label="ariaLabel" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="String(item.value)" :value="item.value">{{ item.label }}</option></select>`,
};

const renderPath = () =>
  render(MaturityStagePath, {
    props: {
      definition,
      trace: entry.trace,
      currentStage: entry.effectiveResult.stage.stage,
      provisional: true,
      questions,
      linkFor: (questionId: string) => ({
        name: "team-review-assessment",
        params: { teamId: "team-1", reviewId: "review-1" },
        hash: `#question-${questionId}`,
      }),
    },
    global: { stubs: { NuxtLink: nuxtLinkStub, USelect: selectStub } },
  });

describe("MaturityStagePath", () => {
  afterEach(() => cleanup());

  it("renders all five canonical stages with the current stage marked by a text cue (AC-034)", () => {
    renderPath();
    for (const name of [
      /Not implemented/,
      /Ad-hoc/,
      /Defined/,
      /Measured/,
      /Optimized/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
    // The fixture resolves to stage 2; the cue is textual, not colour-only.
    const current = screen.getByRole("button", { name: /Ad-hoc/ });
    expect(current.textContent).toContain("Score result");
  });

  it("reveals an earlier stage's associated practices with met/unmet state and deep links (AC-036)", async () => {
    renderPath();
    await fireEvent.click(
      screen.getByRole("button", { name: /Not implemented/ })
    );
    await nextTick();

    const panel = screen.getByRole("region", { name: /Not implemented/ });
    expect(panel.textContent).toContain("Text of Q1");
    expect(panel.textContent).toContain("Text of Q2");
    expect(panel.textContent).toContain("Met");
    expect(panel.textContent).toContain("Unmet");

    const link = screen.getByRole("link", { name: /Text of Q2/ });
    expect(link.getAttribute("href")).toContain("#question-Q2");
  });

  it("reveals only the current stage's associated unmet practices (AC-037)", async () => {
    renderPath();
    await fireEvent.click(screen.getByRole("button", { name: /Ad-hoc/ }));
    await nextTick();

    const panel = screen.getByRole("region", { name: /Ad-hoc/ });
    expect(panel.textContent).toContain("Q3-P2");
    expect(panel.textContent).toContain("Unmet");
    // Q1 is associated with stage 1 and must not leak into the current stage.
    expect(panel.textContent).not.toContain("Text of Q1");
  });

  it("reveals a future stage as guidance, never a target (AC-038)", async () => {
    renderPath();
    await fireEvent.click(screen.getByRole("button", { name: /Measured/ }));
    await nextTick();

    const panel = screen.getByRole("region", { name: /Measured/ });
    expect(panel.textContent).toContain(
      "Practices are measured and improved using evidence."
    );
    expect(panel.textContent).toContain("Instrument the delivery pipeline.");
    expect(panel.textContent).toContain("Text of Q4");
    expect(panel.textContent).toMatch(/guidance, not a (required )?target/i);
    // Practices render as guidance without a met/unmet state badge.
    expect(panel.textContent).not.toContain("Unmet");
  });

  it("announces the revealed content through a live region and moves focus to it (AC-059)", async () => {
    renderPath();
    await fireEvent.click(
      screen.getByRole("button", { name: /Not implemented/ })
    );
    await nextTick();

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Stage 1");
    expect(status.textContent).toContain("Not implemented");

    const panel = screen.getByRole("region", { name: /Not implemented/ });
    expect(document.activeElement).toBe(panel);
  });

  it("filters practices by pillar and by met state with a visible count (AC-057)", async () => {
    renderPath();
    await fireEvent.click(
      screen.getByRole("button", { name: /Not implemented/ })
    );
    await nextTick();

    expect(screen.getByText(/Showing 2 of 2 practices/)).toBeDefined();

    await fireEvent.update(
      screen.getByRole("combobox", { name: /filter by state/i }),
      "met"
    );
    await nextTick();
    const panel = screen.getByRole("region", { name: /Not implemented/ });
    expect(panel.textContent).toContain("Text of Q1");
    expect(panel.textContent).not.toContain("Text of Q2");
    expect(screen.getByText(/Showing 1 of 2 practices/)).toBeDefined();

    await fireEvent.update(
      screen.getByRole("combobox", { name: /filter by state/i }),
      "all"
    );
    await fireEvent.update(
      screen.getByRole("combobox", { name: /filter by pillar/i }),
      "P-B"
    );
    await nextTick();
    expect(screen.getByText(/Showing 0 of 2 practices/)).toBeDefined();
    // AC-061: explicit filtered-empty state with a clearing action.
    expect(screen.getByText(/No practices match/i)).toBeDefined();
    await fireEvent.click(
      screen.getByRole("button", { name: /Clear filters/i })
    );
    await nextTick();
    expect(screen.getByText(/Showing 2 of 2 practices/)).toBeDefined();
  });

  it("resets and announces a filter invalidated by a stage change (AC-058)", async () => {
    renderPath();
    await fireEvent.click(
      screen.getByRole("button", { name: /Not implemented/ })
    );
    await fireEvent.update(
      screen.getByRole("combobox", { name: /filter by state/i }),
      "met"
    );
    await nextTick();

    // The current stage reveals unmet practices only — a "met" filter is inapplicable.
    await fireEvent.click(screen.getByRole("button", { name: /Ad-hoc/ }));
    await nextTick();

    const stateFilter = screen.getByRole("combobox", {
      name: /filter by state/i,
    }) as HTMLSelectElement;
    expect(stateFilter.value).toBe("all");
    expect(screen.getByRole("status").textContent).toMatch(/filter reset/i);
  });
});
