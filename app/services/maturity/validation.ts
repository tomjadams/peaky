/**
 * The one definition-validation contract shared by interactive authoring
 * feedback and publication (maturity-score/REQ-010, REQ-017). Split from
 * definition.ts to stay within the per-file line budget; definition.ts
 * re-exports the public surface.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import { validateAllocations } from "./allocationValidation";
import {
  DEFAULT_THRESHOLDS,
  GUIDANCE_MAX_CHARS,
  LEGACY_DEFAULT_THRESHOLDS,
  MAX_MATURITY_QUESTIONS,
  MIN_STAGE_WIDTH,
  THRESHOLD_TOLERANCE,
  type StageThresholds,
} from "./stages";
import type {
  MaturityDefinition,
  ScorableQuestion,
  StageAssociations,
} from "./definition";

export type DefinitionIssueCode =
  | "too-many-questions"
  | "threshold-not-integer"
  | "threshold-out-of-tolerance"
  | "stage-too-narrow"
  | "allocation-not-checklist"
  | "allocation-unknown-question"
  | "allocation-share-not-integer"
  | "allocation-share-negative"
  | "allocation-share-zero"
  | "allocation-total"
  | "allocation-missing-practice"
  | "allocation-unknown-practice"
  | "guidance-too-long"
  | "guidance-unknown-item"
  | "association-missing"
  | "association-conflict"
  | "association-invalid-stage"
  | "association-unknown-question"
  | "association-unknown-practice"
  | "association-order-inconsistent";

/** Field-addressable validation issue; `path` locates the offending field. */
export interface DefinitionIssue {
  readonly code: DefinitionIssueCode;
  readonly path: string;
  readonly message: string;
}

export function defaultThresholds(): StageThresholds {
  return [...DEFAULT_THRESHOLDS];
}

function countChars(value: string): number {
  return [...value].length;
}

function isWholeNumber(value: number): boolean {
  return Number.isInteger(value);
}

function validateThresholds(
  thresholds: StageThresholds,
  issues: DefinitionIssue[]
): void {
  for (const [index, boundary] of thresholds.entries()) {
    if (!isWholeNumber(boundary)) {
      issues.push({
        code: "threshold-not-integer",
        path: `thresholds[${index}]`,
        message: `Stage boundary ${boundary} is not a whole percentage.`,
      });
      continue;
    }
    const configuredDefault = DEFAULT_THRESHOLDS[index]!;
    const legacyDefault = LEGACY_DEFAULT_THRESHOLDS[index]!;
    const matchesSupportedProfile = [configuredDefault, legacyDefault].some(
      (profileBoundary) =>
        Math.abs(boundary - profileBoundary) <= THRESHOLD_TOLERANCE
    );
    if (!matchesSupportedProfile) {
      issues.push({
        code: "threshold-out-of-tolerance",
        path: `thresholds[${index}]`,
        message: `Stage boundary ${boundary} is outside the supported range for this stage.`,
      });
    }
  }
  const widths = [
    thresholds[0],
    thresholds[1] - thresholds[0],
    thresholds[2] - thresholds[1],
    thresholds[3] - thresholds[2],
    100 - thresholds[3],
  ];
  for (const [index, width] of widths.entries()) {
    if (width < MIN_STAGE_WIDTH) {
      const boundaryIndex = Math.min(index, thresholds.length - 1);
      issues.push({
        code: "stage-too-narrow",
        path: `thresholds[${boundaryIndex}]`,
        message: `Stage ${index + 1} spans ${width} points; every stage must span at least ${MIN_STAGE_WIDTH}.`,
      });
    }
  }
}

function validateGuidance(
  definition: MaturityDefinition,
  questionsById: ReadonlyMap<string, ScorableQuestion>,
  issues: DefinitionIssue[]
): void {
  const check = (path: string, value: string): void => {
    if (countChars(value) > GUIDANCE_MAX_CHARS) {
      issues.push({
        code: "guidance-too-long",
        path,
        message: `Guidance is ${countChars(value)} characters; the limit is ${GUIDANCE_MAX_CHARS}.`,
      });
    }
  };
  for (const [stage, value] of Object.entries(definition.guidance.stages)) {
    check(`guidance.stages.${stage}`, value);
  }
  for (const [questionId, value] of Object.entries(
    definition.guidance.questions
  )) {
    if (!questionsById.has(questionId)) {
      issues.push({
        code: "guidance-unknown-item",
        path: `guidance.questions.${questionId}`,
        message: `Guidance references unknown question ${questionId}.`,
      });
      continue;
    }
    check(`guidance.questions.${questionId}`, value);
  }
  for (const [questionId, perPractice] of Object.entries(
    definition.guidance.practices
  )) {
    const question = questionsById.get(questionId);
    for (const [practiceId, value] of Object.entries(perPractice)) {
      if (!question || !question.practiceIds.includes(practiceId)) {
        issues.push({
          code: "guidance-unknown-item",
          path: `guidance.practices.${questionId}.${practiceId}`,
          message: `Guidance references unknown practice ${practiceId} on question ${questionId}.`,
        });
        continue;
      }
      check(`guidance.practices.${questionId}.${practiceId}`, value);
    }
  }
}

function isValidStage(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function validateAssociationReferences(
  associations: StageAssociations,
  questionsById: ReadonlyMap<string, ScorableQuestion>,
  issues: DefinitionIssue[]
): void {
  for (const [questionId, stage] of Object.entries(associations.questions)) {
    if (!questionsById.has(questionId)) {
      issues.push({
        code: "association-unknown-question",
        path: `associations.questions.${questionId}`,
        message: `Association references unknown question ${questionId}.`,
      });
      continue;
    }
    if (!isValidStage(stage)) {
      issues.push({
        code: "association-invalid-stage",
        path: `associations.questions.${questionId}`,
        message: `Stage ${stage} is not one of the five maturity stages.`,
      });
    }
  }
  for (const [questionId, perPractice] of Object.entries(
    associations.practices
  )) {
    const question = questionsById.get(questionId);
    if (!question) {
      issues.push({
        code: "association-unknown-question",
        path: `associations.practices.${questionId}`,
        message: `Association references unknown question ${questionId}.`,
      });
      continue;
    }
    for (const [practiceId, stage] of Object.entries(perPractice)) {
      if (!question.practiceIds.includes(practiceId)) {
        issues.push({
          code: "association-unknown-practice",
          path: `associations.practices.${questionId}.${practiceId}`,
          message: `Association references unknown practice ${practiceId} on question ${questionId}.`,
        });
      } else if (!isValidStage(stage)) {
        issues.push({
          code: "association-invalid-stage",
          path: `associations.practices.${questionId}.${practiceId}`,
          message: `Stage ${stage} is not one of the five maturity stages.`,
        });
      }
    }
  }
}

function reportMissingPracticeAssociations(
  question: ScorableQuestion,
  perPractice: Readonly<Record<string, number>>,
  issues: DefinitionIssue[]
): void {
  for (const practiceId of question.practiceIds) {
    if (perPractice[practiceId] === undefined) {
      issues.push({
        code: "association-missing",
        path: `associations.practices.${question.questionId}.${practiceId}`,
        message: `Practice ${practiceId} of question ${question.questionId} has no stage association.`,
      });
    }
  }
}

function validateAssociationCompleteness(
  associations: StageAssociations,
  questions: readonly ScorableQuestion[],
  issues: DefinitionIssue[]
): void {
  for (const question of questions) {
    const wholeStage = associations.questions[question.questionId];
    const perPractice = associations.practices[question.questionId];
    if (wholeStage !== undefined && perPractice !== undefined) {
      issues.push({
        code: "association-conflict",
        path: `associations.questions.${question.questionId}`,
        message: `Question ${question.questionId} is associated both as a whole and per practice; choose exactly one.`,
      });
      continue;
    }
    if (wholeStage !== undefined) continue;
    if (question.type === "checklist" && perPractice !== undefined) {
      reportMissingPracticeAssociations(question, perPractice, issues);
      continue;
    }
    issues.push({
      code: "association-missing",
      path: `associations.questions.${question.questionId}`,
      message: `Question ${question.questionId} has no stage association.`,
    });
  }
}

/** Persisted in-stage order covers every associated item exactly once (AC-053). */
function validateStageOrder(
  associations: StageAssociations,
  issues: DefinitionIssue[]
): void {
  const expected = new Map<string, number>();
  for (const [questionId, stage] of Object.entries(associations.questions)) {
    expected.set(questionId, stage);
  }
  for (const [questionId, perPractice] of Object.entries(
    associations.practices
  )) {
    for (const [practiceId, stage] of Object.entries(perPractice)) {
      expected.set(`${questionId}::${practiceId}`, stage);
    }
  }
  const seen = new Map<string, number>();
  let orderConsistent = true;
  for (const [stageKey, entries] of Object.entries(associations.stageOrder)) {
    const stage = Number(stageKey);
    for (const entry of entries) {
      const key =
        entry.practiceId === undefined
          ? entry.questionId
          : `${entry.questionId}::${entry.practiceId}`;
      if (seen.has(key) || expected.get(key) !== stage) orderConsistent = false;
      seen.set(key, stage);
    }
  }
  if (seen.size !== expected.size) orderConsistent = false;
  if (!orderConsistent) {
    issues.push({
      code: "association-order-inconsistent",
      path: "associations.stageOrder",
      message:
        "Persisted in-stage order does not match the stage associations exactly.",
    });
  }
}

function validateAssociations(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[],
  questionsById: ReadonlyMap<string, ScorableQuestion>,
  issues: DefinitionIssue[]
): void {
  validateAssociationReferences(definition.associations, questionsById, issues);
  validateAssociationCompleteness(definition.associations, questions, issues);
  validateStageOrder(definition.associations, issues);
}

/**
 * The one validation contract shared by interactive authoring feedback and
 * publication (REQ-010). Returns every issue; an empty array means the
 * definition may publish.
 */
export function validateMaturityDefinition(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[]
): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  if (questions.length > MAX_MATURITY_QUESTIONS) {
    issues.push({
      code: "too-many-questions",
      path: "questions",
      message: `Template has ${questions.length} questions; a scored TemplateRevision supports at most ${MAX_MATURITY_QUESTIONS}.`,
    });
  }
  const questionsById = new Map(
    questions.map((question) => [question.questionId, question])
  );
  validateThresholds(definition.thresholds, issues);
  validateAllocations(definition, questionsById, issues);
  validateGuidance(definition, questionsById, issues);
  validateAssociations(definition, questions, questionsById, issues);
  return issues;
}
