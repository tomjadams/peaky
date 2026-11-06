import { describe, expect, it } from "vitest";
import { calculateMaturity } from "~/services/maturity/calculate";
import { previewHandoffMaturity } from "~/services/maturity/handoffPreview";
import { makeDefinition, type VectorQuestion } from "./acceptanceVectors";
import {
  checklist,
  wholeQuestionAssociations,
  yesNo,
} from "./calculationFixtures";

function traceFor(questions: readonly VectorQuestion[]) {
  const result = calculateMaturity({
    templateRevisionId: "rev-1",
    definition: makeDefinition(questions, wholeQuestionAssociations(questions)),
    questions,
    answers: Object.fromEntries(
      questions.map((question) => [
        question.questionId,
        question.answer ?? null,
      ])
    ),
  });
  if (result.kind !== "result") throw new Error("Expected maturity result");
  return result.trace;
}

describe("previewHandoffMaturity", () => {
  it("projects one unmet checklist practice with exact one-decimal movement", () => {
    const questions = [
      checklist("Q-CL", "P-A", "high", {
        practices: ["P1", "P2", "P3"],
        answer: { checked: ["P1", "P2"], na: [] },
      }),
    ];

    const preview = previewHandoffMaturity({
      trace: traceFor(questions),
      selectedPractices: [
        {
          templateRevisionId: "rev-1",
          questionId: "Q-CL",
          practiceId: "P3",
        },
      ],
    });

    expect(preview.kind).toBe("available");
    if (preview.kind !== "available") return;
    expect(preview.current.displayPercentTenths).toBe(66.7);
    expect(preview.projected.displayPercentTenths).toBe(100);
    expect(preview.delta.displayPercentagePoints).toBe(33.3);
    expect(preview.practiceOpportunities[0]?.displayPercentagePoints).toBe(
      33.3
    );
    expect(preview.crossesStage).toBe(true);
  });

  it("keeps previews scoped to one exact Template Revision", () => {
    const questions = [yesNo("Q-1", "P-A", "medium", "no")];
    const preview = previewHandoffMaturity({
      trace: traceFor(questions),
      selectedPractices: [
        {
          templateRevisionId: "rev-2",
          questionId: "Q-1",
          practiceId: "Q-1",
        },
      ],
    });

    expect(preview).toMatchObject({
      kind: "unavailable",
      reason: "template-revision-mismatch",
    });
  });

  it("rejects selections that no longer need follow-up", () => {
    const questions = [yesNo("Q-1", "P-A", "medium", "yes")];
    const preview = previewHandoffMaturity({
      trace: traceFor(questions),
      selectedPractices: [
        {
          templateRevisionId: "rev-1",
          questionId: "Q-1",
          practiceId: "Q-1",
        },
      ],
    });

    expect(preview).toMatchObject({
      kind: "unavailable",
      reason: "selection-not-unmet",
    });
  });
});
