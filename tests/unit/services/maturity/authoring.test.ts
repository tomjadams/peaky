/**
 * Interactive authoring operations on the shared maturity definition
 * (maturity-score/REQ-010, REQ-017; AC-011 through AC-014, AC-032, AC-041,
 * AC-045 through AC-053, AC-063). Every operation returns a new immutable
 * definition, keeps the persisted in-stage order consistent (AC-053), and
 * leaves invalid states representable so the shared validator can report
 * field-addressable issues at local save (AC-063).
 */
import { describe, expect, it } from "vitest";
import {
  validateMaturityDefinition,
  type MaturityDefinition,
  type ScorableQuestion,
} from "~/services/maturity/definition";
import { buildDefaultMaturityDefinition } from "~/services/maturity/defaults";
import { calculateMaturity } from "~/services/maturity/calculate";
import {
  DEFAULT_THRESHOLDS,
  MAX_MATURITY_QUESTIONS,
} from "~/services/maturity/stages";
import {
  adjustThreshold,
  bulkAssignPracticeStages,
  canAddScorableQuestion,
  deriveStageOrder,
  enableCustomAllocation,
  equalSharePercent,
  isPracticeDominant,
  maxPracticePoints,
  practiceSharePercent,
  reconcileDefinitionWithQuestions,
  resetEqualThresholds,
  setPracticeGuidance,
  setPracticeShare,
  setPracticeStage,
  setQuestionGuidance,
  setQuestionStage,
  setStageGuidance,
  useEqualAllocation,
  workedExampleAnswers,
} from "~/services/maturity/authoring";

const QUESTIONS: ScorableQuestion[] = [
  {
    questionId: "Q-YN",
    pillarId: "P-A",
    severity: "medium",
    type: "yes-no",
    practiceIds: [],
  },
  {
    questionId: "Q-CL",
    pillarId: "P-A",
    severity: "high",
    type: "checklist",
    practiceIds: ["P1", "P2", "P3"],
  },
  {
    questionId: "Q-CL2",
    pillarId: "P-B",
    severity: "critical",
    type: "checklist",
    practiceIds: ["P4", "P5"],
  },
];

function definitionFor(
  questions: readonly ScorableQuestion[] = QUESTIONS
): MaturityDefinition {
  return buildDefaultMaturityDefinition(questions);
}

function expectValid(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[] = QUESTIONS
): void {
  expect(validateMaturityDefinition(definition, questions)).toEqual([]);
}

describe("adjustThreshold (AC-032)", () => {
  it("moves one boundary and keeps the definition immutable", () => {
    const definition = definitionFor();
    const next = adjustThreshold(definition, 0, 10);

    expect(next.thresholds).toEqual([10, 25, 50, 75]);
    expect(definition.thresholds).toEqual([...DEFAULT_THRESHOLDS]);
    expect(next).not.toBe(definition);
    expectValid(next);
  });

  it("represents out-of-tolerance boundaries so validation can flag them (AC-012)", () => {
    const next = adjustThreshold(definitionFor(), 0, 35);

    const issues = validateMaturityDefinition(next, QUESTIONS);
    expect(
      issues.some(
        (issue) =>
          issue.code === "threshold-out-of-tolerance" &&
          issue.path === "thresholds[0]"
      )
    ).toBe(true);
  });

  it("represents non-integer boundaries so validation can flag them (AC-012)", () => {
    const next = adjustThreshold(definitionFor(), 1, 42.5);

    const issues = validateMaturityDefinition(next, QUESTIONS);
    expect(issues.some((issue) => issue.code === "threshold-not-integer")).toBe(
      true
    );
  });
});

describe("resetEqualThresholds (AC-032)", () => {
  it("restores the configured default bands", () => {
    const custom = adjustThreshold(definitionFor(), 0, 15);
    const reset = resetEqualThresholds(custom);

    expect(reset.thresholds).toEqual([5, 25, 50, 75]);
    expectValid(reset);
  });
});

describe("checklist allocation (AC-013, AC-045)", () => {
  it("enables custom allocation with whole-percentage shares totalling 100", () => {
    const next = enableCustomAllocation(definitionFor(), QUESTIONS[1]!);

    expect(next.allocations["Q-CL"]).toEqual({
      mode: "custom",
      shares: { P1: 34, P2: 33, P3: 33 },
    });
    expectValid(next);
  });

  it("refuses custom allocation for a yes-no question", () => {
    const definition = definitionFor();
    expect(enableCustomAllocation(definition, QUESTIONS[0]!)).toBe(definition);
  });

  it("returns to equal shares", () => {
    const custom = enableCustomAllocation(definitionFor(), QUESTIONS[1]!);
    const equal = useEqualAllocation(custom, "Q-CL");

    expect(equal.allocations["Q-CL"]).toEqual({ mode: "equal" });
    expectValid(equal);
  });

  it("sets a practice share and lets the validator flag a broken total (AC-013)", () => {
    const custom = enableCustomAllocation(definitionFor(), QUESTIONS[1]!);
    const next = setPracticeShare(custom, "Q-CL", "P1", 50);

    expect(next.allocations["Q-CL"]).toMatchObject({
      mode: "custom",
      shares: { P1: 50 },
    });
    const issues = validateMaturityDefinition(next, QUESTIONS);
    expect(
      issues.some(
        (issue) =>
          issue.code === "allocation-total" &&
          issue.path === "allocations.Q-CL.shares"
      )
    ).toBe(true);
  });

  it("derives whole-percentage shares and maximum points for display (AC-045)", () => {
    expect(equalSharePercent(3)).toBe(33);
    expect(practiceSharePercent(definitionFor(), QUESTIONS[1]!, "P2")).toBe(33);
    const custom = setPracticeShare(
      enableCustomAllocation(definitionFor(), QUESTIONS[1]!),
      "Q-CL",
      "P1",
      50
    );
    expect(practiceSharePercent(custom, QUESTIONS[1]!, "P1")).toBe(50);
    expect(maxPracticePoints("high", 50)).toBe(1);
    expect(maxPracticePoints("critical", 33)).toBeCloseTo(0.99, 2);
  });

  it("flags a practice carrying more than half its question weight (AC-046)", () => {
    expect(isPracticeDominant(50)).toBe(false);
    expect(isPracticeDominant(51)).toBe(true);
  });
});

describe("stage association (AC-050 through AC-053)", () => {
  it("moves a whole-question association and keeps deterministic in-stage order", () => {
    const next = setQuestionStage(definitionFor(), QUESTIONS, "Q-CL", 3);

    expect(next.associations.questions["Q-CL"]).toBe(3);
    expect(next.associations.practices["Q-CL"]).toBeUndefined();
    expect(next.associations.stageOrder[3]).toEqual([{ questionId: "Q-CL" }]);
    expect(next.associations.stageOrder[1]).toEqual([
      { questionId: "Q-YN" },
      { questionId: "Q-CL2" },
    ]);
    expectValid(next);
  });

  it("converts to per-practice association initialized from the whole stage", () => {
    const based = setQuestionStage(definitionFor(), QUESTIONS, "Q-CL", 2);
    const next = setPracticeStage(based, QUESTIONS, {
      questionId: "Q-CL",
      practiceId: "P2",
      stage: 4,
    });

    expect(next.associations.questions["Q-CL"]).toBeUndefined();
    expect(next.associations.practices["Q-CL"]).toEqual({
      P1: 2,
      P2: 4,
      P3: 2,
    });
    expectValid(next);
  });

  it("bulk-assigns every practice of a question in one action (AC-051)", () => {
    const next = bulkAssignPracticeStages(
      definitionFor(),
      QUESTIONS,
      "Q-CL",
      5
    );

    expect(next.associations.practices["Q-CL"]).toEqual({
      P1: 5,
      P2: 5,
      P3: 5,
    });
    expectValid(next);
  });

  it("keeps exactly one association shape per question (AC-050)", () => {
    const perPractice = setPracticeStage(definitionFor(), QUESTIONS, {
      questionId: "Q-CL",
      practiceId: "P1",
      stage: 2,
    });
    const whole = setQuestionStage(perPractice, QUESTIONS, "Q-CL", 1);

    expect(whole.associations.questions["Q-CL"]).toBe(1);
    expect(whole.associations.practices["Q-CL"]).toBeUndefined();
    expectValid(whole);
  });

  it("derives stage order from authored question and practice order (AC-053)", () => {
    const based = setQuestionStage(definitionFor(), QUESTIONS, "Q-CL", 2);
    const definition = setPracticeStage(based, QUESTIONS, {
      questionId: "Q-CL",
      practiceId: "P2",
      stage: 1,
    });

    expect(deriveStageOrder(definition.associations, QUESTIONS)[1]).toEqual([
      { questionId: "Q-YN" },
      { questionId: "Q-CL", practiceId: "P2" },
      { questionId: "Q-CL2" },
    ]);
    expect(deriveStageOrder(definition.associations, QUESTIONS)[2]).toEqual([
      { questionId: "Q-CL", practiceId: "P1" },
      { questionId: "Q-CL", practiceId: "P3" },
    ]);
  });
});

describe("guidance editing (AC-047)", () => {
  it("sets and clears optional guidance without touching scoring state (AC-014)", () => {
    const definition = definitionFor();
    const guided = setPracticeGuidance(
      setQuestionGuidance(
        setStageGuidance(definition, 3, "Stage note"),
        "Q-YN",
        "Why"
      ),
      "Q-CL",
      "P1",
      "Practice note"
    );

    expect(guided.guidance.stages[3]).toBe("Stage note");
    expect(guided.guidance.questions["Q-YN"]).toBe("Why");
    expect(guided.guidance.practices["Q-CL"]?.["P1"]).toBe("Practice note");

    const cleared = setQuestionGuidance(guided, "Q-YN", "");
    expect(cleared.guidance.questions["Q-YN"]).toBeUndefined();
    expectValid(guided);
  });

  it("represents over-limit guidance so validation can flag it (AC-047)", () => {
    const next = setStageGuidance(definitionFor(), 2, "x".repeat(241));

    const issues = validateMaturityDefinition(next, QUESTIONS);
    expect(
      issues.some(
        (issue) =>
          issue.code === "guidance-too-long" &&
          issue.path === "guidance.stages.2"
      )
    ).toBe(true);
  });
});

describe("reconcileDefinitionWithQuestions (AC-050, AC-053)", () => {
  it("associates a new question with stage 1 and equal shares when checklist", () => {
    const added: ScorableQuestion = {
      questionId: "Q-NEW",
      pillarId: "P-A",
      severity: "medium",
      type: "checklist",
      practiceIds: ["PN1", "PN2"],
    };
    const next = reconcileDefinitionWithQuestions(definitionFor(), [
      ...QUESTIONS.slice(0, 1),
      added,
      ...QUESTIONS.slice(1),
    ]);

    expect(next.associations.questions["Q-NEW"]).toBe(1);
    expect(next.allocations["Q-NEW"]).toEqual({ mode: "equal" });
    expect(
      next.associations.stageOrder[1].map((entry) => entry.questionId)
    ).toEqual(["Q-YN", "Q-NEW", "Q-CL", "Q-CL2"]);
  });

  it("drops every row of a removed question", () => {
    const guided = setQuestionGuidance(definitionFor(), "Q-CL", "note");
    const next = reconcileDefinitionWithQuestions(
      guided,
      QUESTIONS.filter((question) => question.questionId !== "Q-CL")
    );

    expect(next.associations.questions["Q-CL"]).toBeUndefined();
    expect(next.allocations["Q-CL"]).toBeUndefined();
    expect(next.guidance.questions["Q-CL"]).toBeUndefined();
  });

  it("adds an equal allocation when a question becomes a checklist", () => {
    const switched = QUESTIONS.map((question) =>
      question.questionId === "Q-YN"
        ? { ...question, type: "checklist" as const, practiceIds: ["PA", "PB"] }
        : question
    );
    const next = reconcileDefinitionWithQuestions(definitionFor(), switched);

    expect(next.allocations["Q-YN"]).toEqual({ mode: "equal" });
    expectValid(next, switched);
  });

  it("collapses per-practice state to a whole association when a question becomes yes-no", () => {
    const perPractice = setPracticeStage(definitionFor(), QUESTIONS, {
      questionId: "Q-CL",
      practiceId: "P1",
      stage: 2,
    });
    const switched = QUESTIONS.map((question) =>
      question.questionId === "Q-CL"
        ? { ...question, type: "yes-no" as const, practiceIds: [] }
        : question
    );
    const next = reconcileDefinitionWithQuestions(perPractice, switched);

    expect(next.associations.questions["Q-CL"]).toBe(1);
    expect(next.associations.practices["Q-CL"]).toBeUndefined();
    expect(next.allocations["Q-CL"]).toBeUndefined();
    expectValid(next, switched);
  });

  it("associates a new checklist practice with stage 1 under per-practice association", () => {
    const perPractice = setPracticeStage(definitionFor(), QUESTIONS, {
      questionId: "Q-CL",
      practiceId: "P1",
      stage: 2,
    });
    const grown = QUESTIONS.map((question) =>
      question.questionId === "Q-CL"
        ? { ...question, practiceIds: ["P1", "P2", "P3", "P4NEW"] }
        : question
    );
    const next = reconcileDefinitionWithQuestions(perPractice, grown);

    expect(next.associations.practices["Q-CL"]?.["P4NEW"]).toBe(1);
    expectValid(next, grown);
  });

  it("returns a custom allocation to equal weighting after practices change", () => {
    const custom = enableCustomAllocation(definitionFor(), QUESTIONS[1]!);
    const grown = QUESTIONS.map((question) =>
      question.questionId === "Q-CL"
        ? { ...question, practiceIds: [...question.practiceIds, "P4NEW"] }
        : question
    );

    const next = reconcileDefinitionWithQuestions(custom, grown);

    expect(next.allocations["Q-CL"]).toEqual({ mode: "equal" });
    expectValid(next, grown);
  });

  it("prunes rows that reference unknown questions or practices", () => {
    const definition = definitionFor();
    const dirty: MaturityDefinition = {
      ...definition,
      allocations: {
        ...definition.allocations,
        "Q-GHOST": { mode: "equal" },
      },
    };
    const next = reconcileDefinitionWithQuestions(dirty, QUESTIONS);

    expect(next.allocations["Q-GHOST"]).toBeUndefined();
    expectValid(next);
  });
});

describe("canAddScorableQuestion (AC-041)", () => {
  it("allows up to ten questions and refuses the eleventh", () => {
    expect(canAddScorableQuestion(QUESTIONS)).toBe(true);
    const ten = Array.from({ length: MAX_MATURITY_QUESTIONS }, (_, index) => ({
      questionId: `Q-${index}`,
      pillarId: "P-A",
      severity: "medium" as const,
      type: "yes-no" as const,
      practiceIds: [],
    }));
    expect(canAddScorableQuestion(ten)).toBe(false);
  });
});

describe("workedExampleAnswers (AC-048)", () => {
  it("builds a deterministic mixed answer set from the draft structure", () => {
    const answers = workedExampleAnswers(QUESTIONS);

    expect(answers["Q-YN"]).toBe("yes");
    expect(answers["Q-CL"]).toEqual({ checked: ["P1", "P2"], na: [] });
    expect(answers["Q-CL2"]).toEqual({ checked: ["P4"], na: [] });
    expect(workedExampleAnswers(QUESTIONS)).toEqual(answers);
  });

  it("alternates yes-no answers by authored order", () => {
    const pair: ScorableQuestion[] = [
      { ...QUESTIONS[0]!, questionId: "Q-A" },
      { ...QUESTIONS[0]!, questionId: "Q-B" },
      { ...QUESTIONS[0]!, questionId: "Q-C" },
    ];
    const answers = workedExampleAnswers(pair);

    expect(answers["Q-A"]).toBe("yes");
    expect(answers["Q-B"]).toBe("no");
    expect(answers["Q-C"]).toBe("yes");
  });

  it("feeds the same calculator so severity, share, and boundary edits move the example", () => {
    const definition = definitionFor();
    const base = calculateMaturity({
      templateRevisionId: "worked-example",
      definition,
      questions: QUESTIONS,
      answers: workedExampleAnswers(QUESTIONS),
    });

    const narrowed = adjustThreshold(definition, 3, 70);
    const moved = calculateMaturity({
      templateRevisionId: "worked-example",
      definition: narrowed,
      questions: QUESTIONS,
      answers: workedExampleAnswers(QUESTIONS),
    });
    if (base.kind !== "result" || moved.kind !== "result") {
      throw new Error("worked example must produce a computed result");
    }
    expect(moved.trace.stage.stage).toBeGreaterThanOrEqual(
      base.trace.stage.stage
    );

    const reweighted: ScorableQuestion[] = QUESTIONS.map((question) =>
      question.questionId === "Q-YN"
        ? { ...question, severity: "critical" as const }
        : question
    );
    const heavier = calculateMaturity({
      templateRevisionId: "worked-example",
      definition: reconcileDefinitionWithQuestions(definition, reweighted),
      questions: reweighted,
      answers: workedExampleAnswers(reweighted),
    });
    if (heavier.kind !== "result") {
      throw new Error("worked example must produce a computed result");
    }
    expect(heavier.trace.earned).not.toEqual(base.trace.earned);
  });
});
