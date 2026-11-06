/**
 * Pure maturity calculation driven by the shared acceptance vectors
 * (maturity-score/REQ-011 through REQ-015).
 */
import { describe, expect, it } from "vitest";
import {
  calculateMaturity,
  type AnswerValue,
} from "~/services/maturity/calculate";
import { explainCalculation } from "~/services/maturity/projections";
import {
  addExact,
  deserializeRatio,
  serializeRatio,
  ZERO_RATIO,
} from "~/services/maturity/ratio";
import {
  associate,
  makeDefinition,
  VECTOR_REVISION_ID,
} from "./acceptanceVectors";
import { CALCULATION_VECTORS } from "./calculationVectors";

describe("calculateMaturity (shared acceptance vectors)", () => {
  for (const vector of CALCULATION_VECTORS) {
    it(`${vector.id} [${vector.cites.join(", ")}]`, () => {
      const answers: Record<
        string,
        NonNullable<(typeof vector.questions)[number]["answer"]>
      > = {};
      for (const question of vector.questions) {
        if (question.answer !== undefined && question.answer !== null) {
          answers[question.questionId] = question.answer;
        }
      }
      const calculation = calculateMaturity({
        templateRevisionId: VECTOR_REVISION_ID,
        definition: vector.definition,
        questions: vector.questions,
        answers,
      });

      if (vector.expect.kind === "configuration-error") {
        // AC-042: no trace, percentage, stage, pillar result, or effective value.
        expect(calculation.kind).toBe("configuration-error");
        if (
          calculation.kind !== "configuration-error" ||
          calculation.code !== "question-limit-exceeded"
        )
          return;
        expect(calculation.questionCount).toBe(vector.expect.questionCount);
        expect(calculation).not.toHaveProperty("trace");
        return;
      }

      if (vector.expect.kind === "no-result") {
        // AC-022: explicit no-result, never a zero-percent result.
        expect(calculation.kind).toBe("no-result");
        if (calculation.kind !== "no-result") return;
        expect(calculation.reason).toBe("no-scored-applicable-answer");
        expect(calculation.coverage).toEqual(vector.expect.coverage);
        expect(calculation).not.toHaveProperty("trace");
        return;
      }

      expect(calculation.kind).toBe("result");
      if (calculation.kind !== "result") return;
      const { trace } = calculation;
      const expected = vector.expect;

      // AC-018/AC-055: exact ratio, never rounded before stage resolution.
      expect([trace.result.numerator, trace.result.denominator]).toEqual(
        expected.result
      );
      expect(trace.stage.stage).toBe(expected.stage);
      expect(trace.coverage).toEqual(expected.coverage);

      for (const [questionId, points] of Object.entries(
        expected.questionPoints
      )) {
        const row = trace.questions.find((q) => q.questionId === questionId);
        expect(row, `question ${questionId}`).toBeDefined();
        expect([row!.earned.numerator, row!.earned.denominator]).toEqual(
          points.earned
        );
        expect([row!.available.numerator, row!.available.denominator]).toEqual(
          points.available
        );
      }

      if (expected.questionWeights) {
        for (const [questionId, weight] of Object.entries(
          expected.questionWeights
        )) {
          const row = trace.questions.find((q) => q.questionId === questionId);
          expect(row!.weight).toBe(weight);
        }
      }

      if (expected.pillars) {
        for (const [pillarId, pillar] of Object.entries(expected.pillars)) {
          const row = trace.pillars.find((p) => p.pillarId === pillarId);
          expect(row, `pillar ${pillarId}`).toBeDefined();
          expect(
            row!.result && [row!.result.numerator, row!.result.denominator]
          ).toEqual(pillar.result);
          expect(row!.stage).toBe(pillar.stage);
          expect(row!.answered).toBe(pillar.answered);
          expect(row!.unanswered).toBe(pillar.unanswered);
        }
      }

      // REQ-013/AC-035: display rounds to whole percent; the stage comes from the exact ratio.
      const explanation = explainCalculation(trace);
      expect(explanation.displayPercent).toBe(expected.displayPercent);
      expect(explanation.exactResult).toEqual(trace.result);
      if (expected.boundaryStraddle) {
        expect(explanation.boundaryStraddle?.boundary).toBe(
          expected.boundaryStraddle.boundary
        );
        expect(explanation.boundaryStraddle?.displayPercent).toBe(
          expected.displayPercent
        );
      } else {
        expect(explanation.boundaryStraddle).toBeNull();
      }
    });
  }

  it("never parses the opaque templateRevisionId (AC-009, maturity-score)", () => {
    const vector = CALCULATION_VECTORS.find(
      (v) => v.id === "yes-no-contributes"
    )!;
    const opaqueIds = [
      "rev-0007",
      "01932b3c-7d00-7000-8000-00000000a099",
      "v2::final",
      "7",
    ];
    const traces = opaqueIds.map((templateRevisionId) => {
      const answers: Record<string, string> = {};
      for (const q of vector.questions) {
        if (typeof q.answer === "string") answers[q.questionId] = q.answer;
      }
      const calculation = calculateMaturity({
        templateRevisionId,
        definition: vector.definition,
        questions: vector.questions,
        answers,
      });
      if (calculation.kind !== "result") throw new Error("expected result");
      return calculation.trace;
    });
    // Identical answers under differently-shaped IDs must produce identical results.
    const results = traces.map(
      (t) => `${t.result.numerator}/${t.result.denominator}:${t.stage.stage}`
    );
    expect(new Set(results).size).toBe(1);
    for (const [index, trace] of traces.entries()) {
      expect(trace.templateRevisionId).toBe(opaqueIds[index]);
    }
  });

  it("uses the complete denominator even when only representative rows are displayed (AC-029)", () => {
    const vector = CALCULATION_VECTORS.find(
      (v) => v.id === "canonical-ten-question-template"
    )!;
    const answers: Record<
      string,
      NonNullable<(typeof vector.questions)[number]["answer"]>
    > = {};
    for (const question of vector.questions) {
      if (question.answer) answers[question.questionId] = question.answer;
    }
    const calculation = calculateMaturity({
      templateRevisionId: VECTOR_REVISION_ID,
      definition: vector.definition,
      questions: vector.questions,
      answers,
    });
    if (calculation.kind !== "result") throw new Error("expected result");
    const explanation = explainCalculation(calculation.trace);
    const shown = explanation.questions.slice(0, 3).map((q) => q.questionId);
    const summary = explanation.summarizeRemainder(shown);
    expect(summary.remainder).not.toBeNull();
    expect(summary.remainder!.count).toBe(7);
    // Remainder plus shown rows reconstitute the template totals.
    const shownAvailable = summary.shown.reduce(
      (sum, question) => addExact(sum, deserializeRatio(question.available)),
      ZERO_RATIO
    );
    const reconstitutedAvailable = addExact(
      shownAvailable,
      deserializeRatio(summary.remainder!.available)
    );
    expect(serializeRatio(reconstitutedAvailable)).toEqual(
      calculation.trace.available
    );
  });
});

const checklistQuestion = {
  questionId: "Q-CHECKLIST",
  pillarId: "P-ONE",
  severity: "high" as const,
  type: "checklist" as const,
  practiceIds: ["P-ONE", "P-TWO", "P-THREE"],
};
const checklistDefinition = makeDefinition(
  [checklistQuestion],
  associate([{ id: checklistQuestion.questionId, stage: 2 }])
);

function calculateChecklist(answer: AnswerValue) {
  return calculateMaturity({
    templateRevisionId: "revision-checklist-regression",
    definition: checklistDefinition,
    questions: [checklistQuestion],
    answers: { [checklistQuestion.questionId]: answer },
  });
}

describe("calculateMaturity checklist answer states", () => {
  it("keeps a null checklist unanswered and fully available", () => {
    const calculation = calculateChecklist(null);

    expect(calculation.kind).toBe("no-result");
    if (calculation.kind !== "no-result") return;
    expect(calculation.coverage).toEqual({
      answered: 0,
      unanswered: 1,
      total: 1,
    });
    expect(calculation.questions[0]).toMatchObject({
      state: "unanswered",
      exclusion: "unanswered",
      available: { numerator: "2", denominator: "1" },
      practices: null,
    });
  });

  it("treats an explicit empty checklist as answered with every practice unmet", () => {
    const calculation = calculateChecklist({ checked: [], na: [] });

    expect(calculation.kind).toBe("result");
    if (calculation.kind !== "result") return;
    expect(calculation.trace.coverage).toEqual({
      answered: 1,
      unanswered: 0,
      total: 1,
    });
    expect(calculation.trace.result).toEqual({
      numerator: "0",
      denominator: "1",
    });
    expect(calculation.trace.stage.stage).toBe(1);
    expect(calculation.trace.questions[0]).toMatchObject({
      state: "scored",
      exclusion: null,
      available: { numerator: "2", denominator: "1" },
    });
    expect(
      calculation.trace.questions[0]?.practices?.map(
        (practice) => practice.state
      )
    ).toEqual(["unmet", "unmet", "unmet"]);
  });

  it("treats scalar N/A as an answered whole-checklist exclusion", () => {
    const calculation = calculateChecklist("na");

    expect(calculation.kind).toBe("no-result");
    if (calculation.kind !== "no-result") return;
    expect(calculation.coverage).toEqual({
      answered: 1,
      unanswered: 0,
      total: 1,
    });
    expect(calculation.questions[0]).toMatchObject({
      state: "not-applicable",
      exclusion: "question-na",
      available: { numerator: "0", denominator: "1" },
      earned: { numerator: "0", denominator: "1" },
    });
    expect(
      calculation.questions[0]?.practices?.map((practice) => practice.state)
    ).toEqual(["not-applicable", "not-applicable", "not-applicable"]);
  });

  it("excludes per-practice N/A while scoring the remaining checklist practices", () => {
    const calculation = calculateChecklist({
      checked: ["P-ONE"],
      na: ["P-TWO"],
    });

    expect(calculation.kind).toBe("result");
    if (calculation.kind !== "result") return;
    expect(calculation.trace.result).toEqual({
      numerator: "1",
      denominator: "2",
    });
    expect(
      calculation.trace.questions[0]?.practices?.map((practice) => [
        practice.practiceId,
        practice.state,
      ])
    ).toEqual([
      ["P-ONE", "met"],
      ["P-TWO", "not-applicable"],
      ["P-THREE", "unmet"],
    ]);
  });

  it.each(["yes", "no"] as const)(
    "treats scalar %s on a checklist as unanswered",
    (answer) => {
      const calculation = calculateChecklist(answer);

      expect(calculation.kind).toBe("no-result");
      if (calculation.kind !== "no-result") return;
      expect(calculation.coverage).toEqual({
        answered: 0,
        unanswered: 1,
        total: 1,
      });
      expect(calculation.questions[0]).toMatchObject({
        state: "unanswered",
        exclusion: "unanswered",
        practices: null,
      });
    }
  );

  it("returns a configuration error instead of dividing by zero for a non-positive custom share", () => {
    const definition = makeDefinition(
      [checklistQuestion],
      associate([{ id: checklistQuestion.questionId, stage: 2 }]),
      {
        allocations: {
          [checklistQuestion.questionId]: {
            mode: "custom",
            shares: { "P-ONE": 100, "P-TWO": 0, "P-THREE": 0 },
          },
        },
      }
    );

    const calculation = calculateMaturity({
      templateRevisionId: "revision-zero-share",
      definition,
      questions: [checklistQuestion],
      answers: {
        [checklistQuestion.questionId]: {
          checked: [],
          na: ["P-ONE"],
        },
      },
    });

    expect(calculation).toEqual({
      kind: "configuration-error",
      code: "non-positive-custom-share",
      templateRevisionId: "revision-zero-share",
      questionId: checklistQuestion.questionId,
      practiceId: "P-TWO",
      share: 0,
    });
  });

  it("keeps positive custom shares exact when another practice is N/A", () => {
    const definition = makeDefinition(
      [checklistQuestion],
      associate([{ id: checklistQuestion.questionId, stage: 2 }]),
      {
        allocations: {
          [checklistQuestion.questionId]: {
            mode: "custom",
            shares: { "P-ONE": 50, "P-TWO": 25, "P-THREE": 25 },
          },
        },
      }
    );
    const calculation = calculateMaturity({
      templateRevisionId: "revision-positive-shares",
      definition,
      questions: [checklistQuestion],
      answers: {
        [checklistQuestion.questionId]: {
          checked: ["P-TWO"],
          na: ["P-ONE"],
        },
      },
    });

    expect(calculation.kind).toBe("result");
    if (calculation.kind !== "result") return;
    expect(calculation.trace.result).toEqual({
      numerator: "1",
      denominator: "2",
    });
    expect(calculation.trace.earned).toEqual({
      numerator: "1",
      denominator: "2",
    });
    expect(calculation.trace.available).toEqual({
      numerator: "1",
      denominator: "1",
    });
  });
});

const yesNoQuestion = {
  questionId: "Q-YES-NO",
  pillarId: "P-ONE",
  severity: "medium" as const,
  type: "yes-no" as const,
  practiceIds: [],
};

describe("calculateMaturity defensive answer shapes", () => {
  it("treats a checklist object on a yes/no question as unanswered, not N/A", () => {
    const calculation = calculateMaturity({
      templateRevisionId: "revision-retyped",
      definition: makeDefinition(
        [yesNoQuestion],
        associate([{ id: yesNoQuestion.questionId, stage: 1 }])
      ),
      questions: [yesNoQuestion],
      answers: {
        [yesNoQuestion.questionId]: { checked: [], na: [] },
      },
    });

    expect(calculation.kind).toBe("no-result");
    if (calculation.kind !== "no-result") return;
    expect(calculation.coverage).toEqual({
      answered: 0,
      unanswered: 1,
      total: 1,
    });
    expect(calculation.questions[0]).toMatchObject({
      state: "unanswered",
      exclusion: "unanswered",
      practices: null,
    });
  });
});
