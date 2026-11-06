import { describe, expect, it } from "vitest";
import { calculateMaturity } from "~/services/maturity/calculate";
import { projectPillarQuestions } from "~/services/maturity/pillarQuestions";
import { makeDefinition } from "./acceptanceVectors";
import {
  checklist,
  wholeQuestionAssociations,
  yesNo,
} from "./calculationFixtures";

function tracedQuestions() {
  const questions = [
    checklist("Q-CL", "P-A", "high", {
      practices: ["P1", "P2", "P3"],
      answer: { checked: ["P1"], na: ["P3"] },
    }),
    yesNo("Q-OPEN", "P-A", "medium"),
  ];
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

describe("projectPillarQuestions", () => {
  it("explains current question evidence without forecasting opportunity", () => {
    const breakdown = projectPillarQuestions({
      trace: tracedQuestions(),
      pillarId: "P-A",
      questions: new Map([
        [
          "Q-CL",
          {
            questionId: "Q-CL",
            questionReference: "REL-1",
            text: "How mature is reliability?",
            practices: [
              { id: "P1", text: "Practice one" },
              { id: "P2", text: "Practice two" },
              { id: "P3", text: "Practice three" },
            ],
          },
        ],
        [
          "Q-OPEN",
          {
            questionId: "Q-OPEN",
            questionReference: "REL-2",
            text: "How mature is recovery?",
            practices: [],
          },
        ],
      ]),
    });

    expect(breakdown).not.toBeNull();
    expect(breakdown!.questions[0]).toMatchObject({
      questionReference: "REL-1",
      title: "How mature is reliability?",
      answerStatusLabel: "Answered",
      contributionLabel: "Partial evidence earned",
      practices: [
        { id: "P1", title: "Practice one", stateLabel: "Met" },
        { id: "P2", title: "Practice two", stateLabel: "Needs follow-up" },
        { id: "P3", title: "Practice three", stateLabel: "Not counted" },
      ],
    });
    expect(breakdown!.questions[0]).not.toHaveProperty("opportunity");
    expect(breakdown!.questions[1]).toMatchObject({
      answerStatusLabel: "Unanswered",
      contributionLabel: "No answer recorded",
      evidenceCompletionPercent: null,
    });
  });
});
