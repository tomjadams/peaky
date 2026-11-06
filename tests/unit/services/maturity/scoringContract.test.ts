import { describe, expect, it } from "vitest";
import {
  calculateMaturity,
  type AnswerValue,
  type MaturityCalculation,
} from "~/services/maturity/calculate";
import type { ScorableQuestion } from "~/services/maturity/definition";
import { explainCalculation } from "~/services/maturity/projections";
import { makeDefinition } from "./acceptanceVectors";
import { wholeQuestionAssociations } from "./calculationFixtures";

const REVISION_ID = "maturity-contract-revision";

type ResultCalculation = Extract<MaturityCalculation, { kind: "result" }>;
type RatioTuple = readonly [string, string];

function yesNo(
  questionId: string,
  severity: ScorableQuestion["severity"] = "medium",
  pillarId = "P-A"
): ScorableQuestion {
  return {
    questionId,
    pillarId,
    severity,
    type: "yes-no",
    practiceIds: [],
  };
}

function checklist(
  questionId: string,
  severity: ScorableQuestion["severity"],
  practiceIds: readonly string[],
  pillarId = "P-A"
): ScorableQuestion {
  return {
    questionId,
    pillarId,
    severity,
    type: "checklist",
    practiceIds,
  };
}

function calculate(
  questions: readonly ScorableQuestion[],
  answers: Readonly<Record<string, AnswerValue>> = {}
): MaturityCalculation {
  return calculateMaturity({
    templateRevisionId: REVISION_ID,
    definition: makeDefinition(questions, wholeQuestionAssociations(questions)),
    questions,
    answers,
  });
}

function requireResult(calculation: MaturityCalculation): ResultCalculation {
  expect(calculation.kind).toBe("result");
  if (calculation.kind !== "result") {
    throw new Error(`expected result, received ${calculation.kind}`);
  }
  return calculation;
}

function ratioTuple(ratio: {
  readonly numerator: string;
  readonly denominator: string;
}): RatioTuple {
  return [ratio.numerator, ratio.denominator];
}

function expectResult(
  calculation: MaturityCalculation,
  expected: {
    earned: RatioTuple;
    available: RatioTuple;
    result: RatioTuple;
    displayPercent: number;
    stage: number;
    coverage: { answered: number; unanswered: number; total: number };
  }
): ResultCalculation {
  const result = requireResult(calculation);
  expect(ratioTuple(result.trace.earned)).toEqual(expected.earned);
  expect(ratioTuple(result.trace.available)).toEqual(expected.available);
  expect(ratioTuple(result.trace.result)).toEqual(expected.result);
  expect(explainCalculation(result.trace).displayPercent).toBe(
    expected.displayPercent
  );
  expect(result.trace.stage.stage).toBe(expected.stage);
  expect(result.trace.coverage).toEqual(expected.coverage);
  return result;
}

describe("maturity scoring contract", () => {
  it("keeps all configured questions available before and after answers are recorded", () => {
    const questions = Array.from({ length: 10 }, (_, index) =>
      yesNo(`Q-${index + 1}`)
    );

    const unanswered = calculate(questions);
    expect(unanswered.kind).toBe("no-result");
    if (unanswered.kind !== "no-result") return;
    expect(unanswered.reason).toBe("no-scored-applicable-answer");
    expect(unanswered.coverage).toEqual({
      answered: 0,
      unanswered: 10,
      total: 10,
    });
    expect(unanswered.questions.map((question) => question.state)).toEqual(
      Array.from({ length: 10 }, () => "unanswered")
    );
    expect(
      unanswered.questions.map((question) => ratioTuple(question.available))
    ).toEqual(Array.from({ length: 10 }, () => ["1", "1"]));

    expectResult(calculate(questions, { "Q-1": "yes" }), {
      earned: ["1", "1"],
      available: ["10", "1"],
      result: ["1", "10"],
      displayPercent: 10,
      stage: 1,
      coverage: { answered: 1, unanswered: 9, total: 10 },
    });
    expectResult(calculate(questions, { "Q-1": "yes", "Q-2": "no" }), {
      earned: ["1", "1"],
      available: ["10", "1"],
      result: ["1", "10"],
      displayPercent: 10,
      stage: 1,
      coverage: { answered: 2, unanswered: 8, total: 10 },
    });
    expectResult(calculate(questions, { "Q-1": "yes", "Q-2": "yes" }), {
      earned: ["2", "1"],
      available: ["10", "1"],
      result: ["1", "5"],
      displayPercent: 20,
      stage: 2,
      coverage: { answered: 2, unanswered: 8, total: 10 },
    });
  });

  it("uses full severity weight for unanswered questions and removes whole-question N/A", () => {
    const questions = [
      yesNo("Q-MEDIUM", "medium"),
      yesNo("Q-HIGH", "high"),
      yesNo("Q-CRITICAL", "critical"),
    ];

    expectResult(calculate(questions, { "Q-MEDIUM": "yes", "Q-HIGH": "no" }), {
      earned: ["1", "1"],
      available: ["6", "1"],
      result: ["1", "6"],
      displayPercent: 17,
      stage: 1,
      coverage: { answered: 2, unanswered: 1, total: 3 },
    });
    expectResult(
      calculate(questions, {
        "Q-MEDIUM": "yes",
        "Q-HIGH": "no",
        "Q-CRITICAL": "yes",
      }),
      {
        earned: ["4", "1"],
        available: ["6", "1"],
        result: ["2", "3"],
        displayPercent: 67,
        stage: 4,
        coverage: { answered: 3, unanswered: 0, total: 3 },
      }
    );
    expectResult(calculate(questions, { "Q-MEDIUM": "yes" }), {
      earned: ["1", "1"],
      available: ["6", "1"],
      result: ["1", "6"],
      displayPercent: 17,
      stage: 1,
      coverage: { answered: 1, unanswered: 2, total: 3 },
    });
    expectResult(calculate(questions, { "Q-MEDIUM": "yes", "Q-HIGH": "na" }), {
      earned: ["1", "1"],
      available: ["4", "1"],
      result: ["1", "4"],
      displayPercent: 25,
      stage: 2,
      coverage: { answered: 2, unanswered: 1, total: 3 },
    });
  });

  it("removes only an N/A practice's exact share without renormalizing aggregate points", () => {
    const questions = [
      checklist("Q-CHECKLIST", "high", ["P-1", "P-2", "P-3", "P-4"]),
      yesNo("Q-UNANSWERED", "high"),
    ];
    const result = expectResult(
      calculate(questions, {
        "Q-CHECKLIST": { checked: ["P-1", "P-2"], na: ["P-3"] },
      }),
      {
        earned: ["1", "1"],
        available: ["7", "2"],
        result: ["2", "7"],
        displayPercent: 29,
        stage: 2,
        coverage: { answered: 1, unanswered: 1, total: 2 },
      }
    );

    const checklistTrace = result.trace.questions[0]!;
    expect(ratioTuple(checklistTrace.earned)).toEqual(["1", "1"]);
    expect(ratioTuple(checklistTrace.available)).toEqual(["3", "2"]);
    expect(ratioTuple(checklistTrace.result!)).toEqual(["2", "3"]);
  });

  it("records an explicit empty checklist without changing its numeric contribution", () => {
    const questions = [
      yesNo("Q-YES", "medium"),
      checklist("Q-CHECKLIST", "high", ["P-1", "P-2"]),
    ];
    const before = expectResult(calculate(questions, { "Q-YES": "yes" }), {
      earned: ["1", "1"],
      available: ["3", "1"],
      result: ["1", "3"],
      displayPercent: 33,
      stage: 2,
      coverage: { answered: 1, unanswered: 1, total: 2 },
    });
    expect(before.trace.questions[1]).toMatchObject({
      state: "unanswered",
      practices: null,
    });

    const after = expectResult(
      calculate(questions, {
        "Q-YES": "yes",
        "Q-CHECKLIST": { checked: [], na: [] },
      }),
      {
        earned: ["1", "1"],
        available: ["3", "1"],
        result: ["1", "3"],
        displayPercent: 33,
        stage: 2,
        coverage: { answered: 2, unanswered: 0, total: 2 },
      }
    );
    expect(
      after.trace.questions[1]?.practices?.map((practice) => practice.state)
    ).toEqual(["unmet", "unmet"]);
  });

  it("uses the exact one-fifth boundary before display rounding", () => {
    const questions = Array.from({ length: 5 }, (_, index) =>
      yesNo(`Q-${index + 1}`)
    );

    expectResult(calculate(questions, { "Q-1": "yes" }), {
      earned: ["1", "1"],
      available: ["5", "1"],
      result: ["1", "5"],
      displayPercent: 20,
      stage: 2,
      coverage: { answered: 1, unanswered: 4, total: 5 },
    });
  });

  it("returns no result when answers are only N/A and all other questions are unanswered", () => {
    const questions = [
      yesNo("Q-WHOLE-NA"),
      checklist("Q-PRACTICES-NA", "high", ["P-1", "P-2"]),
      yesNo("Q-UNANSWERED", "critical"),
    ];
    const calculation = calculate(questions, {
      "Q-WHOLE-NA": "na",
      "Q-PRACTICES-NA": { checked: [], na: ["P-1", "P-2"] },
    });

    expect(calculation.kind).toBe("no-result");
    if (calculation.kind !== "no-result") return;
    expect(calculation.coverage).toEqual({
      answered: 2,
      unanswered: 1,
      total: 3,
    });
    expect(calculation.questions.map((question) => question.state)).toEqual([
      "not-applicable",
      "not-applicable",
      "unanswered",
    ]);
    expect(
      calculation.questions.map((question) => ratioTuple(question.available))
    ).toEqual([
      ["0", "1"],
      ["0", "1"],
      ["3", "1"],
    ]);
  });

  it("withholds a pillar result until that pillar has a scored applicable answer", () => {
    const questions = [
      yesNo("Q-A-YES", "medium", "P-A"),
      yesNo("Q-A-OPEN", "high", "P-A"),
      yesNo("Q-B-OPEN", "critical", "P-B"),
    ];
    const result = expectResult(calculate(questions, { "Q-A-YES": "yes" }), {
      earned: ["1", "1"],
      available: ["6", "1"],
      result: ["1", "6"],
      displayPercent: 17,
      stage: 1,
      coverage: { answered: 1, unanswered: 2, total: 3 },
    });

    const pillarA = result.trace.pillars.find(
      (pillar) => pillar.pillarId === "P-A"
    )!;
    expect(ratioTuple(pillarA.available)).toEqual(["3", "1"]);
    expect(ratioTuple(pillarA.result!)).toEqual(["1", "3"]);
    expect(pillarA.stage).toBe(2);

    const pillarB = result.trace.pillars.find(
      (pillar) => pillar.pillarId === "P-B"
    )!;
    expect(ratioTuple(pillarB.available)).toEqual(["3", "1"]);
    expect(pillarB.result).toBeNull();
    expect(pillarB.stage).toBeNull();
  });
});
