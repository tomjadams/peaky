/**
 * Calculation fixtures: the question sets the shared acceptance vectors score.
 * Split from calculationVectors.ts to stay within the per-file line budget.
 */
import type { StageAssociations } from "~/services/maturity/definition";
import { associate, type VectorQuestion } from "./acceptanceVectors";

export function yesNo(
  questionId: string,
  pillarId: string,
  severity: "critical" | "high" | "medium",
  answer?: "yes" | "no" | "na"
): VectorQuestion {
  return {
    questionId,
    pillarId,
    severity,
    type: "yes-no",
    practiceIds: [],
    answer: answer ?? null,
  };
}

export function checklist(
  questionId: string,
  pillarId: string,
  severity: "critical" | "high" | "medium",
  options: {
    practices: readonly string[];
    answer?: { checked: string[]; na: string[] };
  }
): VectorQuestion {
  return {
    questionId,
    pillarId,
    severity,
    type: "checklist",
    practiceIds: options.practices,
    answer: options.answer ?? null,
  };
}

/** AC-017: severity supplies the fixed weight; all-No scores 0%. */

export const severityWeightsQuestions = [
  yesNo("Q-MED", "P-A", "medium", "no"),
  yesNo("Q-HIGH", "P-A", "high", "no"),
  yesNo("Q-CRIT", "P-A", "critical", "no"),
];

/** AC-015: Yes = 100%, No = 0%, weighted by severity. */
export const yesNoQuestions = [
  yesNo("Q-YES-CRIT", "P-A", "critical", "yes"),
  yesNo("Q-NO-HIGH", "P-A", "high", "no"),
  yesNo("Q-YES-MED", "P-A", "medium", "yes"),
];

/** AC-016 + AC-055: equal shares stay exact 1/n ratios. */
export const equalChecklistQuestions = [
  checklist("Q-CL", "P-A", "high", {
    practices: ["P1", "P2", "P3"],
    answer: { checked: ["P1", "P2"], na: [] },
  }),
];

/** AC-013 + AC-016: custom shares cap the question contribution at its weight. */
export const customAllocationQuestions = [
  checklist("Q-CL", "P-A", "critical", {
    practices: ["P1", "P2", "P3"],
    answer: { checked: ["P2", "P3"], na: [] },
  }),
];

/** AC-020: an N/A practice removes only its exact configured weighted share. */
export const partialNaQuestions = [
  checklist("Q-CL", "P-A", "medium", {
    practices: ["P1", "P2", "P3", "P4"],
    answer: { checked: ["P1", "P2"], na: ["P4"] },
  }),
];

/** AC-021: all-N/A counts as answered, leaves the denominator. */
export const allNaQuestions = [
  checklist("Q-CL", "P-A", "high", {
    practices: ["P1", "P2"],
    answer: { checked: [], na: ["P1", "P2"] },
  }),
  yesNo("Q-YN", "P-A", "medium", "yes"),
];

/** AC-019: unanswered stays available and unearned while reducing coverage. */
export const unansweredQuestions = [
  yesNo("Q-YES", "P-A", "medium", "yes"),
  yesNo("Q-OPEN", "P-A", "medium"),
];

/** AC-022: no scored applicable answer means an explicit no-result, never 0%. */
export const noApplicableQuestions = [
  yesNo("Q-NA", "P-A", "medium", "na"),
  yesNo("Q-OPEN", "P-A", "medium"),
];

/** AC-023: an exact boundary enters the higher stage. */
export const boundary20Questions = [
  yesNo("Q-1", "P-A", "medium", "yes"),
  ...[1, 2, 3, 4].map((i) => yesNo(`Q-X${i}`, "P-A", "medium", "no")),
];
export const boundary60Questions = [
  yesNo("Q-1", "P-A", "critical", "yes"),
  yesNo("Q-2", "P-A", "high", "no"),
];
export const boundary80Questions = [
  yesNo("Q-1", "P-A", "high", "yes"),
  yesNo("Q-2", "P-A", "high", "yes"),
  yesNo("Q-3", "P-A", "medium", "no"),
];

/** AC-012 + AC-024: advanced thresholds move the bands. */
export const advancedThresholdsQuestions = [
  yesNo("Q-1", "P-A", "medium", "yes"),
  yesNo("Q-2", "P-A", "critical", "no"),
];
export const advancedHalfQuestions = [
  yesNo("Q-1", "P-A", "medium", "yes"),
  yesNo("Q-2", "P-A", "medium", "no"),
];

/**
 * AC-024 + AC-035: exact 199/250 = 79.6% displays as 80% but stays stage 4;
 * the explanation must name the straddled boundary (80).
 */
export const straddleQuestions = [
  checklist("Q-CL", "P-A", "critical", {
    practices: ["P1", "P2"],
    answer: { checked: ["P1"], na: [] },
  }),
  yesNo("Q-YN", "P-A", "high", "yes"),
];

/** Canonical ten-question template (REQ-011 through REQ-015, AC-018, AC-026). */
export const tenQuestions: VectorQuestion[] = [
  yesNo("KQ1", "P-A", "critical", "yes"),
  checklist("KQ2", "P-A", "high", {
    practices: ["P1", "P2", "P3", "P4"],
    answer: { checked: ["P1", "P2"], na: ["P4"] },
  }),
  yesNo("KQ3", "P-A", "medium", "no"),
  checklist("KQ4", "P-A", "medium", {
    practices: ["P1", "P2"],
    answer: { checked: ["P1", "P2"], na: [] },
  }),
  yesNo("KQ5", "P-A", "high"),
  checklist("KQ6", "P-B", "critical", {
    practices: ["P1", "P2", "P3"],
    answer: { checked: ["P1"], na: [] },
  }),
  yesNo("KQ7", "P-B", "medium", "na"),
  checklist("KQ8", "P-B", "high", {
    practices: ["P1", "P2", "P3"],
    answer: { checked: [], na: [] },
  }),
  yesNo("KQ9", "P-B", "medium", "yes"),
  checklist("KQ10", "P-B", "medium", {
    practices: ["P1"],
    answer: { checked: ["P1"], na: [] },
  }),
];

/** AC-042: eleven questions on a pinned Revision is a scoped configuration error. */
export const elevenQuestions: VectorQuestion[] = Array.from(
  { length: 11 },
  (_, i) => yesNo(`Q-${i + 1}`, "P-A", "medium", "yes")
);

export function wholeQuestionAssociations(
  questions: readonly VectorQuestion[],
  stage = 1
): StageAssociations {
  return associate(questions.map((q) => ({ id: q.questionId, stage })));
}
