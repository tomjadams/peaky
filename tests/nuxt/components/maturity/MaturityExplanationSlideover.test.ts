/**
 * Trace-backed calculation explanation slideover (maturity-score/REQ-015;
 * AC-024, AC-028, AC-029, AC-035; provenance AC-030).
 *
 * The slideover reads the calculation trace: exact unrounded result, every
 * question or an explicit summarized remainder, exclusions, points,
 * thresholds, coverage, override provenance, and the boundary-straddle
 * explanation when whole-number display appears to cross a stage boundary.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import MaturityExplanationSlideover from "~/components/maturity/MaturityExplanationSlideover.vue";
import { buildWorkspace, type ReviewWorkspace } from "~/models/workspace";
import { serializeMaturityDefinition } from "~/services/maturity/persistence";
import { indexStagePathQuestions } from "~/services/maturity/stagePath";
import {
  advisorOverride,
  resultEntry,
  stagePathWorkspace,
  straddleWorkspace,
  tenQuestionWorkspace,
} from "./fixtures";
import {
  associate,
  makeDefinition,
} from "../../../unit/services/maturity/acceptanceVectors";
import { checklist } from "../../../unit/services/maturity/calculationFixtures";
import {
  makeAnswers,
  makePillars,
  makeRevision,
  makeWorkspaceOptions,
} from "../../../unit/services/maturity/workspaceFixtures";

const slideoverStub = {
  props: ["open", "title"],
  template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /></div>`,
};

const renderExplanation = (workspace: ReviewWorkspace) =>
  render(MaturityExplanationSlideover, {
    props: {
      open: true,
      workspace,
      entry: resultEntry(workspace),
      questions: indexStagePathQuestions(
        workspace.pillars.filter(
          (pillar) => pillar.templateRevisionId === "rev-1"
        )
      ),
    },
    global: { stubs: { USlideover: slideoverStub } },
  });

function equalShareWorkspace(): ReviewWorkspace {
  const questions = [
    checklist("Q-THIRDS", "P-A", "medium", {
      practices: ["T-1", "T-2", "T-3"],
      answer: { checked: ["T-1"], na: [] },
    }),
    checklist("Q-SIXTHS", "P-A", "medium", {
      practices: ["S-1", "S-2", "S-3", "S-4", "S-5", "S-6"],
      answer: { checked: ["S-1"], na: [] },
    }),
  ];
  const definition = makeDefinition(
    questions,
    associate([
      { id: "Q-THIRDS", stage: 1 },
      { id: "Q-SIXTHS", stage: 2 },
    ])
  );
  return buildWorkspace(
    makeWorkspaceOptions({
      templateRevisions: [
        makeRevision("rev-1", 0, serializeMaturityDefinition(definition)),
      ],
      pillars: makePillars("rev-1", questions),
      answers: makeAnswers(questions),
    })
  );
}

describe("MaturityExplanationSlideover", () => {
  afterEach(() => cleanup());

  it("exposes the exact unrounded result beside the whole-percent display (AC-024, AC-035)", () => {
    renderExplanation(straddleWorkspace());
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });
    // Exact 199/250 = 79.6% — the value the stage was resolved from.
    expect(dialog.textContent).toContain("199/250");
    expect(dialog.textContent).toContain("79.6%");
    expect(dialog.textContent).toContain("Displayed as 80%");
  });

  it("leads with a plain-language result and hides exact arithmetic and practice shares behind disclosures", () => {
    renderExplanation(stagePathWorkspace());
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });

    expect(
      screen.getByRole("heading", { name: "What this means" })
    ).toBeDefined();
    expect(dialog.textContent).toContain(
      "Provisional. 1 unanswered question currently contributes 0 points, so this result can still change."
    );
    expect(screen.getByText("Show exact calculation")).toBeDefined();
    expect(
      screen.getAllByText(/Show \d+ practice details/).length
    ).toBeGreaterThan(0);
  });

  it("explains when whole-number display appears to cross a stage boundary (AC-035)", () => {
    renderExplanation(straddleWorkspace());
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });
    expect(dialog.textContent).toMatch(
      /displayed 80% appears to cross the pinned 80% boundary/i
    );
    expect(dialog.textContent).toMatch(
      /stage resolution uses the exact result/i
    );
  });

  it("renders thresholds, coverage, exclusions, and per-question points from the trace (AC-028)", () => {
    renderExplanation(stagePathWorkspace());
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });
    expect(dialog.textContent).toContain("20%");
    expect(dialog.textContent).toContain("40%");
    expect(dialog.textContent).toContain("60%");
    expect(dialog.textContent).toContain("80%");
    expect(dialog.textContent).toMatch(/4 of 5 questions answered/);
    // Question rows: text, weight, result, and exclusion reasons.
    expect(dialog.textContent).toContain("Text of Q1");
    expect(dialog.textContent).toContain("Text of Q5");
    expect(dialog.textContent).toMatch(/Unanswered · Not assessed/);
    expect(dialog.textContent).toMatch(/Approximate points: 2.50 of 10/);
    expect(dialog.textContent).toMatch(/0.50 of 1 points/);
  });

  it("summarizes the remaining questions explicitly instead of sampling (AC-029)", () => {
    renderExplanation(tenQuestionWorkspace());
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });
    expect(dialog.textContent).toMatch(/5 more questions/);
    expect(dialog.textContent).toMatch(/1 of 1.50 points/);
    // The remainder contributes its exact points — never dropped.
    expect(dialog.textContent).toMatch(/contribute/);
  });

  it("pairs recurring equal shares with their exact ratios and approximate percentages", () => {
    renderExplanation(equalShareWorkspace());
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });

    expect(dialog.textContent).toContain("share 1/3 · about 33.3%");
    expect(dialog.textContent).toContain("share 1/6 · about 16.7%");
    expect(dialog.textContent).not.toContain("share 33%");
    expect(dialog.textContent).not.toContain("share 17%");
  });

  it("shows override provenance while the calculated result stays visible (AC-030)", () => {
    renderExplanation(stagePathWorkspace([advisorOverride]));
    const dialog = screen.getByRole("dialog", {
      name: /How maturity is calculated/i,
    });
    expect(dialog.textContent).toContain("advisor-1");
    expect(dialog.textContent).toContain("Evidence verified on site.");
    expect(dialog.textContent).toContain("EV-100");
    // Calculated value remains discoverable next to the reviewed value.
    expect(dialog.textContent).toMatch(/Calculated: 25%/);
    expect(dialog.textContent).toMatch(/Reviewed: 75%/);
  });
});
