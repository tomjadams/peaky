/**
 * Interactive authoring operations on the shared maturity definition
 * (maturity-score/REQ-010, REQ-017; AC-011 through AC-014, AC-032, AC-041,
 * AC-045 through AC-053, AC-063).
 *
 * Every operation returns a new immutable definition. Operations never reject
 * invalid input themselves: threshold, allocation, and guidance mistakes stay
 * representable so the shared validator reports them as field-addressable
 * issues at local save (AC-063). The persisted in-stage order is re-derived
 * from authored question and practice order after every change (AC-053).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type {
  MaturityDefinition,
  ScorableQuestion,
  StageAssociations,
} from "./definition";
import {
  DEFAULT_THRESHOLDS,
  LEGACY_DEFAULT_THRESHOLDS,
  MAX_MATURITY_QUESTIONS,
  type StageThresholds,
} from "./stages";
import { severityWeight } from "./definition";
import type { AnswerValue } from "./calculate";

/**
 * Writable view of the deeply readonly definition for copy-on-write edits.
 * The conditional distributes over union members (equal/custom allocation).
 */
type Draft<T> = T extends object
  ? { -readonly [K in keyof T]: Draft<T[K]> }
  : T;

function clone(definition: MaturityDefinition): Draft<MaturityDefinition> {
  return structuredClone(definition) as Draft<MaturityDefinition>;
}

/** Removes one dynamic key, returning a new record (dynamic `delete` is banned). */
function withoutKey<V>(
  record: Record<string, V>,
  key: string
): Record<string, V> {
  const { [key]: _dropped, ...rest } = record;
  return rest;
}

/** Filters a record's entries, returning a new record. */
function filterRecord<V>(
  record: Record<string, V>,
  keep: (key: string, value: V) => boolean
): Record<string, V> {
  return Object.fromEntries(
    Object.entries(record).filter(([key, value]) => keep(key, value))
  );
}

function emptyStageOrder(): StageAssociations["stageOrder"] {
  return { 1: [], 2: [], 3: [], 4: [], 5: [] };
}

/**
 * Derives the persisted in-stage order from the associations and the authored
 * question and practice order (AC-053). Deterministic: identical inputs
 * always produce the same order.
 */
export function deriveStageOrder(
  associations: Pick<StageAssociations, "questions" | "practices">,
  questions: readonly ScorableQuestion[]
): StageAssociations["stageOrder"] {
  const stageOrder = emptyStageOrder();
  for (const question of questions) {
    const wholeStage = associations.questions[question.questionId];
    if (wholeStage !== undefined) {
      stageOrder[wholeStage as 1 | 2 | 3 | 4 | 5].push({
        questionId: question.questionId,
      });
      continue;
    }
    const perPractice = associations.practices[question.questionId];
    if (!perPractice) continue;
    for (const practiceId of question.practiceIds) {
      const stage = perPractice[practiceId];
      if (stage === undefined) continue;
      stageOrder[stage as 1 | 2 | 3 | 4 | 5].push({
        questionId: question.questionId,
        practiceId,
      });
    }
  }
  return stageOrder;
}

function withDerivedOrder(
  next: Draft<MaturityDefinition>,
  questions: readonly ScorableQuestion[]
): MaturityDefinition {
  next.associations.stageOrder = deriveStageOrder(next.associations, questions);
  return next as MaturityDefinition;
}

/** Moves one stage boundary; validation flags out-of-contract values (AC-012, AC-032). */
export function adjustThreshold(
  definition: MaturityDefinition,
  index: 0 | 1 | 2 | 3,
  value: number
): MaturityDefinition {
  const next = clone(definition);
  next.thresholds[index] = value;
  return next as MaturityDefinition;
}

/** Restores the configured default bands (AC-032). */
export function resetEqualThresholds(
  definition: MaturityDefinition
): MaturityDefinition {
  const next = clone(definition);
  next.thresholds = [
    ...DEFAULT_THRESHOLDS,
  ] as unknown as Draft<StageThresholds>;
  return next as MaturityDefinition;
}

/**
 * Enables custom shares for a checklist question, split in whole percentages
 * totalling exactly 100; earlier practices absorb the remainder (AC-013).
 * Non-checklist questions cannot carry an allocation: returns the input.
 */
export function enableCustomAllocation(
  definition: MaturityDefinition,
  question: ScorableQuestion
): MaturityDefinition {
  if (question.type !== "checklist" || question.practiceIds.length === 0) {
    return definition;
  }
  const count = question.practiceIds.length;
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  const shares: Record<string, number> = {};
  question.practiceIds.forEach((practiceId, index) => {
    shares[practiceId] = base + (index < remainder ? 1 : 0);
  });
  const next = clone(definition);
  next.allocations[question.questionId] = { mode: "custom", shares };
  return next as MaturityDefinition;
}

/** Returns a checklist question to the equal-shares default (AC-013). */
export function useEqualAllocation(
  definition: MaturityDefinition,
  questionId: string
): MaturityDefinition {
  const next = clone(definition);
  next.allocations[questionId] = { mode: "equal" };
  return next as MaturityDefinition;
}

/** Sets one custom practice share; the validator flags a broken total (AC-013). */
export function setPracticeShare(
  definition: MaturityDefinition,
  questionId: string,
  practiceId: string,
  share: number
): MaturityDefinition {
  const next = clone(definition);
  const allocation = next.allocations[questionId];
  if (!allocation || allocation.mode !== "custom") return definition;
  allocation.shares[practiceId] = share;
  return next as MaturityDefinition;
}

/** Whole-percentage display share for an equal split (AC-045). */
export function equalSharePercent(practiceCount: number): number {
  return practiceCount === 0 ? 0 : Math.round(100 / practiceCount);
}

/** The share a practice currently contributes, as a whole display percentage (AC-045). */
export function practiceSharePercent(
  definition: MaturityDefinition,
  question: ScorableQuestion,
  practiceId: string
): number {
  const allocation = definition.allocations[question.questionId];
  if (!allocation || allocation.mode === "equal") {
    return equalSharePercent(question.practiceIds.length);
  }
  return allocation.shares[practiceId] ?? 0;
}

/** Display-only maximum points a share can contribute (AC-045); never fed to the calculator. */
export function maxPracticePoints(
  severity: ScorableQuestion["severity"],
  sharePercent: number
): number {
  return (
    Math.round(((severityWeight(severity) * sharePercent) / 100) * 100) / 100
  );
}

/** A practice carrying more than half its question's weight raises the advisory (AC-046). */
export function isPracticeDominant(sharePercent: number): boolean {
  return sharePercent > 50;
}

/** Associates a whole question with one stage, clearing per-practice state (AC-050, AC-051). */
export function setQuestionStage(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[],
  questionId: string,
  stage: number
): MaturityDefinition {
  const next = clone(definition);
  next.associations.questions[questionId] = stage;
  next.associations.practices = withoutKey(
    next.associations.practices,
    questionId
  );
  return withDerivedOrder(next, questions);
}

/**
 * Sets one practice's stage, converting the question to per-practice
 * association initialized from its current whole stage (default 1) (AC-051).
 */
export function setPracticeStage(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[],
  target: {
    readonly questionId: string;
    readonly practiceId: string;
    readonly stage: number;
  }
): MaturityDefinition {
  const { questionId, practiceId, stage } = target;
  const question = questions.find(
    (candidate) => candidate.questionId === questionId
  );
  if (!question) return definition;
  const baseStage = definition.associations.questions[questionId] ?? 1;
  const next = clone(definition);
  const perPractice: Record<string, number> = {
    ...next.associations.practices[questionId],
  };
  for (const id of question.practiceIds) {
    perPractice[id] ??= baseStage;
  }
  perPractice[practiceId] = stage;
  next.associations.practices[questionId] = perPractice;
  next.associations.questions = withoutKey(
    next.associations.questions,
    questionId
  );
  return withDerivedOrder(next, questions);
}

/** Associates every practice of a question with one stage in one action (AC-051). */
export function bulkAssignPracticeStages(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[],
  questionId: string,
  stage: number
): MaturityDefinition {
  const question = questions.find(
    (candidate) => candidate.questionId === questionId
  );
  if (!question) return definition;
  const next = clone(definition);
  const perPractice: Record<string, number> = {};
  for (const practiceId of question.practiceIds) {
    perPractice[practiceId] = stage;
  }
  next.associations.practices[questionId] = perPractice;
  next.associations.questions = withoutKey(
    next.associations.questions,
    questionId
  );
  return withDerivedOrder(next, questions);
}

function setGuidanceValue(
  record: Record<string, string>,
  key: string,
  text: string
): Record<string, string> {
  return text === "" ? withoutKey(record, key) : { ...record, [key]: text };
}

/** Optional scoring-independent stage guidance; empty text clears it (AC-014, AC-047). */
export function setStageGuidance(
  definition: MaturityDefinition,
  stage: number,
  text: string
): MaturityDefinition {
  const next = clone(definition);
  next.guidance.stages = setGuidanceValue(
    next.guidance.stages,
    String(stage),
    text
  );
  return next as MaturityDefinition;
}

export function setQuestionGuidance(
  definition: MaturityDefinition,
  questionId: string,
  text: string
): MaturityDefinition {
  const next = clone(definition);
  next.guidance.questions = setGuidanceValue(
    next.guidance.questions,
    questionId,
    text
  );
  return next as MaturityDefinition;
}

export function setPracticeGuidance(
  definition: MaturityDefinition,
  questionId: string,
  practiceId: string,
  text: string
): MaturityDefinition {
  const next = clone(definition);
  const perPractice = setGuidanceValue(
    { ...next.guidance.practices[questionId] },
    practiceId,
    text
  );
  next.guidance.practices[questionId] = perPractice;
  return next as MaturityDefinition;
}

function migrateLegacyDefaultThresholds(
  definition: Draft<MaturityDefinition>
): void {
  if (
    definition.thresholds.every(
      (boundary, index) => boundary === LEGACY_DEFAULT_THRESHOLDS[index]
    )
  ) {
    definition.thresholds = [
      ...DEFAULT_THRESHOLDS,
    ] as unknown as Draft<StageThresholds>;
  }
}

/**
 * Reconciles the definition with the current draft structure after questions
 * or checklist practices are added, removed, reordered, or retyped. New
 * questions associate as a whole with stage 1 and checklist questions gain an
 * explicit equal allocation, so a structurally sound draft stays valid
 * (AC-049, AC-050); removed items lose every row; unknown references are
 * pruned.
 */
export function reconcileDefinitionWithQuestions(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[]
): MaturityDefinition {
  const next = clone(definition);
  migrateLegacyDefaultThresholds(next);
  const byId = new Map(
    questions.map((question) => [question.questionId, question])
  );

  next.allocations = filterRecord(next.allocations, (questionId) =>
    byId.has(questionId)
  );
  next.associations.questions = filterRecord(
    next.associations.questions,
    (questionId) => byId.has(questionId)
  );
  next.associations.practices = filterRecord(
    next.associations.practices,
    (questionId) => {
      const question = byId.get(questionId);
      return question?.type === "checklist";
    }
  );
  for (const [questionId, perPractice] of Object.entries(
    next.associations.practices
  )) {
    const question = byId.get(questionId)!;
    next.associations.practices[questionId] = filterRecord(
      perPractice,
      (practiceId) => question.practiceIds.includes(practiceId)
    );
  }
  next.guidance.questions = filterRecord(
    next.guidance.questions,
    (questionId) => byId.has(questionId)
  );
  next.guidance.practices = filterRecord(
    next.guidance.practices,
    (questionId) => {
      const question = byId.get(questionId);
      return question?.type === "checklist";
    }
  );
  for (const [questionId, perPractice] of Object.entries(
    next.guidance.practices
  )) {
    const question = byId.get(questionId)!;
    next.guidance.practices[questionId] = filterRecord(
      perPractice,
      (practiceId) => question.practiceIds.includes(practiceId)
    );
  }

  for (const question of questions) {
    const isChecklist = question.type === "checklist";
    const allocation = next.allocations[question.questionId];
    if (isChecklist && allocation?.mode === "custom") {
      const allocatedPracticeIds = Object.keys(allocation.shares);
      const structureChanged =
        allocatedPracticeIds.length !== question.practiceIds.length ||
        allocatedPracticeIds.some(
          (practiceId) => !question.practiceIds.includes(practiceId)
        );
      if (structureChanged) {
        next.allocations[question.questionId] = { mode: "equal" };
      }
    } else if (isChecklist && !allocation) {
      next.allocations[question.questionId] = { mode: "equal" };
    }
    if (!isChecklist) {
      next.allocations = withoutKey(next.allocations, question.questionId);
    }
    const whole = next.associations.questions[question.questionId];
    const perPractice = next.associations.practices[question.questionId];
    if (!isChecklist && perPractice) {
      next.associations.questions[question.questionId] = 1;
      next.associations.practices = withoutKey(
        next.associations.practices,
        question.questionId
      );
      continue;
    }
    if (whole === undefined && perPractice === undefined) {
      next.associations.questions[question.questionId] = 1;
      continue;
    }
    if (isChecklist && perPractice) {
      for (const practiceId of question.practiceIds) {
        perPractice[practiceId] ??= 1;
      }
    }
  }

  return withDerivedOrder(next, questions);
}

/** The eleventh scored question is prevented in the studio (AC-041). */
export function canAddScorableQuestion(
  questions: readonly ScorableQuestion[]
): boolean {
  return questions.length < MAX_MATURITY_QUESTIONS;
}

/**
 * The fixed worked-example assumption (AC-048): Yes/No questions alternate
 * Yes/No by authored order and every checklist contributes its first half of
 * practices in authored order. The example is computed by the same calculator
 * as review results and is always labelled as an example, never a result.
 */
export function workedExampleAnswers(
  questions: readonly ScorableQuestion[]
): Record<string, AnswerValue> {
  const answers: Record<string, AnswerValue> = {};
  questions.forEach((question, index) => {
    if (question.type === "checklist") {
      answers[question.questionId] = {
        checked: question.practiceIds.slice(
          0,
          Math.ceil(question.practiceIds.length / 2)
        ),
        na: [],
      };
      return;
    }
    answers[question.questionId] = index % 2 === 0 ? "yes" : "no";
  });
  return answers;
}
