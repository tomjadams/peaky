import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/vue";
import type { QuestionAnswer } from "~/models/question";
import MaturityPreview from "~/components/template-studio/MaturityPreview.vue";
import type {
  MaturityDefinition,
  ScorableQuestion,
} from "~/services/maturity/definition";
import {
  associate,
  makeDefinition,
  type VectorQuestion,
} from "../../../unit/services/maturity/acceptanceVectors";
import {
  checklist,
  straddleQuestions,
  wholeQuestionAssociations,
  yesNo,
} from "../../../unit/services/maturity/calculationFixtures";
import { stagePathDefinition, stagePathQuestions } from "../maturity/fixtures";

function answersFor(
  questions: readonly VectorQuestion[]
): Record<string, QuestionAnswer> {
  const answers: Record<string, QuestionAnswer> = {};
  for (const question of questions) {
    if (question.answer == null) continue;
    answers[question.questionId] =
      typeof question.answer === "string"
        ? question.answer
        : {
            checked: [...question.answer.checked],
            na: [...question.answer.na],
          };
  }
  return answers;
}

const baseProps = {
  templateRevisionId: "revision-preview",
  definition: stagePathDefinition,
  questions: stagePathQuestions,
  answers: answersFor(stagePathQuestions),
};

function renderPreview(overrides: Partial<typeof baseProps> = {}) {
  return render(MaturityPreview, {
    props: { ...baseProps, ...overrides },
    global: {
      stubs: {
        TemplateStudioMaturityStagePopover: {
          props: [
            "stage",
            "thresholds",
            "percent",
            "displayPercent",
            "triggerClass",
          ],
          template: `
            <span
              class="shared-stage-popover-stub"
              :data-stage="stage"
              :data-thresholds="thresholds.join(',')"
              :data-percent="percent"
              :data-display-percent="displayPercent"
              :data-trigger-class="triggerClass"
            >
              <slot name="trigger" />
            </span>
          `,
        },
      },
    },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Template Studio maturity preview", () => {
  it("keeps the all-unanswered result empty while retaining available points", async () => {
    renderPreview({ answers: {} });

    expect(
      screen.getByText("Answer one question to see the score")
    ).toBeTruthy();
    expect(screen.getByText("0 of 5 answered")).toBeTruthy();
    expect(screen.queryByLabelText("Maturity score preview")).toBeNull();

    const trigger = screen.getByRole("button", { name: "How scoring works" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.querySelector(".iconify")?.className).toContain(
      "i-lucide:chevron-down"
    );
    expect(screen.queryByLabelText("Current scoring equation")).toBeNull();

    await fireEvent.click(trigger);
    expect(trigger.querySelector(".iconify")?.className).toContain(
      "i-lucide:chevron-up"
    );
    const equation = within(screen.getByLabelText("Current scoring equation"));
    expect(equation.getByLabelText("0 points earned")).toBeTruthy();
    expect(
      equation.getByLabelText("10 weighted points available from 5 questions")
    ).toBeTruthy();
    expect(equation.getByLabelText("— maturity")).toBeTruthy();
    expect(equation.queryByText(/Score stage/)).toBeNull();
  });

  it("shows the live score, exact stage, and coverage without extra panels", () => {
    renderPreview();

    const score = within(screen.getByLabelText("Maturity score preview"));
    expect(score.getByText("25%")).toBeTruthy();
    expect(score.getByText("Stage 2 · Ad-hoc")).toBeTruthy();
    expect(screen.getByText(/Provisional score/).textContent).toContain(
      "4 of 5 answered"
    );
    expect(screen.queryByText(/Earlier-stage gaps/)).toBeNull();
    expect(screen.queryByText(/Not assessed practices/)).toBeNull();
  });

  it("keeps the live scoring equation and rules in persistent inline flow", async () => {
    const view = renderPreview();

    const trigger = screen.getByRole("button", { name: "How scoring works" });
    await fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const details = document.getElementById("maturity-preview-scoring-details");
    expect(details).toBeTruthy();
    expect(details?.className).not.toContain("absolute");
    expect(details?.className).not.toContain("border");
    expect(
      screen
        .getByRole("heading", { name: "Maturity · current draft" })
        .closest("section")?.className
    ).not.toContain("border");
    expect(
      within(details!).getByRole("heading", { name: "Live calculation" })
    ).toBeTruthy();
    expect(
      within(details!).getByText("Updates with every answer")
    ).toBeTruthy();
    expect(
      within(details!).getByRole("heading", { name: "Scoring rules" })
    ).toBeTruthy();
    const plate = details?.querySelector("[data-live-calculation]");
    expect(plate?.className).toContain("bg-elevated");
    expect(plate?.className).toContain("rounded-lg");
    expect(plate?.className).toContain("shadow-[0_10px_24px");
    expect(details?.querySelectorAll("[data-live-calculation]")).toHaveLength(
      1
    );

    const equation = within(screen.getByLabelText("Current scoring equation"));
    expect(equation.getByLabelText("2.5 points earned")).toBeTruthy();
    expect(equation.getByText("÷")).toBeTruthy();
    expect(
      equation.getByLabelText("10 weighted points available from 5 questions")
    ).toBeTruthy();
    expect(equation.getByText("from 5 questions")).toBeTruthy();
    expect(equation.getByText("=")).toBeTruthy();
    expect(equation.getByLabelText("25% maturity")).toBeTruthy();
    expect(equation.getByText("Score stage")).toBeTruthy();
    expect(equation.getByText("Stage 2 · Ad-hoc")).toBeTruthy();

    expect(screen.getByText("Current question mix")).toBeTruthy();
    expect(
      screen.getByText("Checklist items share question weight")
    ).toBeTruthy();
    expect(
      screen.getByText("Unanswered earns 0; its weight stays available")
    ).toBeTruthy();
    expect(screen.getByText("N/A · excluded, not × 0")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Note" })).toBeTruthy();
    expect(
      screen.getByText(/They do not see question severity labels/)
    ).toBeTruthy();
    expect(screen.getByText(/not on increasing the score/)).toBeTruthy();
    const rules = screen
      .getByRole("heading", { name: "Scoring rules" })
      .closest("section");
    const ruleRows = rules?.querySelectorAll("[data-scoring-rule]") ?? [];
    expect(ruleRows).toHaveLength(3);
    expect(rules?.className).not.toContain("border");
    for (const row of ruleRows) {
      expect(row.className).not.toContain("border");
      expect(row.querySelector(".iconify")).toBeTruthy();
    }

    const medium = screen.getByLabelText("1 Medium question at 1 point each");
    const high = screen.getByLabelText("3 High questions at 2 points each");
    const critical = screen.getByLabelText(
      "1 Critical question at 3 points each"
    );
    expect(medium.className).toContain("text-muted");
    expect(high.className).toContain("#92400E");
    expect(critical.className).toContain("#B91C1C");
    expect(
      [medium, high, critical].every(
        (mark) =>
          !mark.className.includes("rounded") &&
          !mark.className.includes("border")
      )
    ).toBe(true);
    expect(screen.queryByText(/Preview answers clear on reload/)).toBeNull();

    await view.rerender({
      ...baseProps,
      answers: {
        ...baseProps.answers,
        Q5: { checked: ["Q5-P1"], na: [] },
      },
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.getElementById("maturity-preview-scoring-details")
    ).toBeTruthy();
    const updatedEquation = within(
      screen.getByLabelText("Current scoring equation")
    );
    expect(updatedEquation.getByLabelText("3.5 points earned")).toBeTruthy();
    expect(updatedEquation.getByLabelText("35% maturity")).toBeTruthy();

    await fireEvent.click(trigger);
    expect(
      document.getElementById("maturity-preview-scoring-details")
    ).toBeNull();
  });

  it("formats fractional N/A point removal to at most two decimals", async () => {
    const questions = [
      checklist("Q-FRACTIONAL", "P-A", "medium", {
        practices: ["P1", "P2", "P3"],
      }),
    ];
    const definition = makeDefinition(
      questions,
      associate([{ id: "Q-FRACTIONAL", stage: 1 }])
    );
    renderPreview({
      definition,
      questions,
      answers: {
        "Q-FRACTIONAL": { checked: ["P1"], na: ["P3"] },
      },
    });

    await fireEvent.click(
      screen.getByRole("button", { name: "How scoring works" })
    );

    const equation = within(screen.getByLabelText("Current scoring equation"));
    expect(equation.getByLabelText("0.33 points earned")).toBeTruthy();
    expect(
      equation.getByLabelText("0.67 weighted points available from 1 question")
    ).toBeTruthy();
    expect(equation.getByLabelText("50% maturity")).toBeTruthy();
    expect(equation.queryByText(/0\.333|0\.666/)).toBeNull();
  });

  it("delegates stage context to the shared popover API", () => {
    renderPreview();

    const popover = document.querySelector(".shared-stage-popover-stub");
    expect(popover).toBeTruthy();
    expect(popover?.getAttribute("data-stage")).toBe("2");
    expect(popover?.getAttribute("data-thresholds")).toBe("20,40,60,80");
    expect(popover?.getAttribute("data-percent")).toBe("25");
    expect(popover?.getAttribute("data-display-percent")).toBe("25");
    expect(popover?.getAttribute("data-trigger-class")).toBe("text-base");
    expect(popover?.textContent?.trim()).toBe("Stage 2 · Ad-hoc");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows only severity categories that contribute to the current mix", async () => {
    const questions = [
      yesNo("Q1", "P-A", "medium", "yes"),
      yesNo("Q2", "P-A", "medium"),
    ];
    const definition = makeDefinition(
      questions,
      wholeQuestionAssociations(questions),
      { thresholds: [5, 25, 50, 75] }
    );
    renderPreview({
      definition,
      questions,
      answers: { Q1: "yes" },
    });

    await fireEvent.click(
      screen.getByRole("button", { name: "How scoring works" })
    );

    expect(
      screen.getByLabelText("2 Medium questions at 1 point each")
    ).toBeTruthy();
    expect(screen.queryByText(/High × 2/)).toBeNull();
    expect(screen.queryByText(/Critical × 3/)).toBeNull();
  });

  it("keeps unanswered points in the denominator so starting an answer cannot reset the score", async () => {
    const questions = [
      yesNo("Q1", "P-A", "medium", "yes"),
      yesNo("Q2", "P-A", "medium"),
      yesNo("Q3", "P-A", "medium"),
      yesNo("Q4", "P-A", "medium"),
      yesNo("Q5", "P-A", "medium"),
    ];
    const definition = makeDefinition(
      questions,
      wholeQuestionAssociations(questions),
      { thresholds: [5, 25, 50, 75] }
    );
    const view = renderPreview({
      definition,
      questions,
      answers: { Q1: "yes" },
    });

    expect(screen.getByText("20%")).toBeTruthy();
    expect(screen.getByText("Stage 2 · Ad-hoc")).toBeTruthy();

    await view.rerender({
      ...baseProps,
      definition,
      questions,
      answers: { Q1: "yes", Q2: "no" },
    });
    expect(screen.getByText("20%")).toBeTruthy();

    await view.rerender({
      ...baseProps,
      definition,
      questions,
      answers: { Q1: "yes", Q2: "yes" },
    });
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("Stage 3 · Defined")).toBeTruthy();
  });

  it("uses the exact calculator stage when display rounding reaches a boundary", () => {
    const definition = makeDefinition(
      straddleQuestions,
      wholeQuestionAssociations(straddleQuestions),
      {
        allocations: {
          "Q-CL": { mode: "custom", shares: { P1: 66, P2: 34 } },
        },
      }
    );

    renderPreview({
      definition,
      questions: straddleQuestions,
      answers: answersFor(straddleQuestions),
    });

    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("Stage 4 · Measured")).toBeTruthy();
    expect(screen.queryByText("Stage 5 · Optimized")).toBeNull();

    const popover = document.querySelector(".shared-stage-popover-stub");
    expect(popover?.getAttribute("data-percent")).toBe("79.6");
    expect(popover?.getAttribute("data-display-percent")).toBe("80");
  });

  it("distinguishes an unanswered checklist from an explicit empty answer", async () => {
    const questions: VectorQuestion[] = [
      {
        questionId: "Q-EMPTY",
        pillarId: "P-A",
        severity: "medium",
        type: "checklist",
        practiceIds: ["P-ONE", "P-TWO"],
      },
    ];
    const definition = makeDefinition(
      questions,
      associate([{ id: "Q-EMPTY", stage: 1 }]),
      { thresholds: [5, 25, 50, 75] }
    );
    const view = renderPreview({ definition, questions, answers: {} });

    expect(
      screen.getByText("Answer one question to see the score")
    ).toBeTruthy();

    await view.rerender({
      ...baseProps,
      definition,
      questions,
      answers: { "Q-EMPTY": [] },
    });

    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("Stage 1 · Not implemented")).toBeTruthy();
    expect(screen.getByText("1 of 1 answered")).toBeTruthy();
  });

  it("announces the initial result and later coverage changes", async () => {
    const view = renderPreview();
    const liveStatus = screen.getByRole("status");

    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    await waitFor(() =>
      expect(liveStatus.textContent).toContain("Maturity score 25%")
    );

    await view.rerender({
      ...baseProps,
      answers: { ...baseProps.answers, Q5: [] },
    });
    await waitFor(() =>
      expect(liveStatus.textContent).toContain("5 of 5 answered")
    );
  });

  it("shows concise unavailable and empty-template states", () => {
    const invalidDefinition: MaturityDefinition = {
      ...stagePathDefinition,
      thresholds: [1, 40, 60, 80],
    };
    const invalid = renderPreview({ definition: invalidDefinition });
    expect(screen.getByText("Score preview unavailable")).toBeTruthy();
    invalid.unmount();

    renderPreview({
      questions: [] as ScorableQuestion[],
      answers: {},
    });
    expect(
      screen.getByText("Add a question to preview the score")
    ).toBeTruthy();
  });
});
