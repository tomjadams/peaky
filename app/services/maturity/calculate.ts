/**
 * Deterministic maturity calculation (maturity-score/REQ-011 through REQ-013).
 *
 * One pure function derives question, pillar, and complete-template results
 * from the pinned definition plus current answers, using exact integer ratios
 * end to end: no scaling, no floating point, no rounding before stage
 * resolution. Every projection and explanation consumes the returned trace
 * instead of recalculating (REQ-015). Guidance and stage associations are not
 * part of the input, so authoring them cannot change the trace (AC-014,
 * AC-054). `templateRevisionId` is an opaque string, compared exactly and
 * never parsed.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import {
  addExact,
  compareToPercent,
  deserializeRatio,
  divideExact,
  exactRatio,
  multiplyExact,
  serializeRatio,
  ZERO_RATIO,
  type ExactRatio,
  type SerializedRatio,
} from "./ratio";
import {
  severityWeight,
  type MaturityDefinition,
  type ScorableQuestion,
} from "./definition";
import {
  MATURITY_STAGES,
  MAX_MATURITY_QUESTIONS,
  type MaturityStageNumber,
  type StageThresholds,
} from "./stages";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";

/** Normalized answer input; adapters convert stored shapes before calling. */
export type AnswerValue =
  | "yes"
  | "no"
  | "na"
  | { readonly checked: readonly string[]; readonly na: readonly string[] }
  | null;

export interface CalculateMaturityInput {
  /** Opaque identifier — compared exactly, never parsed (AC-009). */
  readonly templateRevisionId: string;
  readonly definition: MaturityDefinition;
  readonly questions: readonly ScorableQuestion[];
  /** Keyed by question id; a missing entry means unanswered. */
  readonly answers: Readonly<Record<string, AnswerValue>>;
}

export type QuestionTraceState = "scored" | "unanswered" | "not-applicable";
export type QuestionExclusion =
  | "unanswered"
  | "question-na"
  | "all-practices-na";

export interface PracticeTrace {
  readonly practiceId: string;
  /** Configured share of the question weight as an exact ratio. */
  readonly share: SerializedRatio;
  /** Binary evidence state; N/A practices are reported separately (AC-019 improvement-plans). */
  readonly state: "met" | "unmet" | "not-applicable";
}

export interface QuestionTrace {
  readonly questionId: string;
  readonly pillarId: string;
  /** Fixed severity-derived weight (AC-017). */
  readonly weight: number;
  readonly state: QuestionTraceState;
  readonly exclusion: QuestionExclusion | null;
  /** Met-share over applicable-share for scored questions. */
  readonly result: SerializedRatio | null;
  /** Earned points; exact zero while unanswered or not applicable. */
  readonly earned: SerializedRatio;
  /** Exact available points after whole-question or per-practice N/A removal. */
  readonly available: SerializedRatio;
  readonly practices: readonly PracticeTrace[] | null;
}

export interface PillarTrace {
  readonly pillarId: string;
  readonly earned: SerializedRatio;
  readonly available: SerializedRatio;
  readonly result: SerializedRatio | null;
  readonly stage: MaturityStageNumber | null;
  readonly answered: number;
  readonly unanswered: number;
  readonly total: number;
}

export interface Coverage {
  readonly answered: number;
  readonly unanswered: number;
  readonly total: number;
}

export interface ResolvedStage {
  readonly stage: MaturityStageNumber;
  readonly name: string;
  readonly description: string;
  /** Whole-percent band [lower, upper) resolved from the pinned thresholds. */
  readonly band: { readonly lower: number; readonly upper: number };
  /** The pinned boundary the exact result reached or crossed; null for stage 1. */
  readonly enteredBoundary: number | null;
}

export const CALCULATION_TRACE_SCHEMA_VERSION = 2;

export interface CalculationTrace {
  readonly schemaVersion: typeof CALCULATION_TRACE_SCHEMA_VERSION;
  readonly templateRevisionId: string;
  readonly thresholds: StageThresholds;
  readonly questions: readonly QuestionTrace[];
  /** Explanatory only; never feeds the template result (AC-018, AC-026). */
  readonly pillars: readonly PillarTrace[];
  readonly earned: SerializedRatio;
  readonly available: SerializedRatio;
  /** Exact unrounded template result used for stage resolution (AC-035). */
  readonly result: SerializedRatio;
  readonly stage: ResolvedStage;
  readonly coverage: Coverage;
}

export type MaturityCalculation =
  | { readonly kind: "result"; readonly trace: CalculationTrace }
  | {
      /** AC-022: explicit no-result, never a zero-percent stand-in. */
      readonly kind: "no-result";
      readonly reason: "no-scored-applicable-answer";
      readonly templateRevisionId: string;
      readonly thresholds: StageThresholds;
      readonly questions: readonly QuestionTrace[];
      readonly coverage: Coverage;
    }
  | {
      /** AC-042: over-limit pinned Revision — no trace, result, or stage. */
      readonly kind: "configuration-error";
      readonly code: "question-limit-exceeded";
      readonly templateRevisionId: string;
      readonly questionCount: number;
      readonly limit: number;
    }
  | {
      /** Rejects invalid legacy configuration before undefined ratio arithmetic. */
      readonly kind: "configuration-error";
      readonly code: "non-positive-custom-share";
      readonly templateRevisionId: string;
      readonly questionId: string;
      readonly practiceId: string;
      readonly share: number;
    };

/** Builds the ResolvedStage presentation for a known stage number. */
export function describeStage(
  stage: MaturityStageNumber,
  thresholds: StageThresholds
): ResolvedStage {
  const constant = MATURITY_STAGES[stage - 1]!;
  return {
    stage,
    name: constant.name,
    description: constant.description,
    band: {
      lower: stage === 1 ? 0 : thresholds[stage - 2]!,
      upper: stage === 5 ? 100 : thresholds[stage - 1]!,
    },
    enteredBoundary: stage === 1 ? null : thresholds[stage - 2]!,
  };
}

/** Resolves the stage from the unrounded result; an exact boundary enters the higher stage (AC-023). */
export function resolveStage(
  result: ExactRatio,
  thresholds: StageThresholds
): ResolvedStage {
  let stage: MaturityStageNumber = 1;
  for (const boundary of thresholds) {
    if (compareToPercent(result, boundary) >= 0) {
      stage = (stage + 1) as MaturityStageNumber;
    }
  }
  return describeStage(stage, thresholds);
}

function practiceShare(
  definition: MaturityDefinition,
  question: ScorableQuestion,
  practiceId: string
): ExactRatio {
  const allocation = definition.allocations[question.questionId];
  if (allocation?.mode === "custom") {
    return exactRatio(allocation.shares[practiceId] ?? 0, 100);
  }
  // Equal shares stay an exact 1/n ratio; no remainder distribution (AC-055).
  return exactRatio(1, Math.max(question.practiceIds.length, 1));
}

function findNonPositiveCustomShare(
  definition: MaturityDefinition,
  questions: readonly ScorableQuestion[]
): { questionId: string; practiceId: string; share: number } | null {
  for (const question of questions) {
    if (question.type !== "checklist") continue;
    const allocation = definition.allocations[question.questionId];
    if (allocation?.mode !== "custom") continue;
    for (const practiceId of question.practiceIds) {
      const share = allocation.shares[practiceId];
      if (share !== undefined && share <= 0) {
        return { questionId: question.questionId, practiceId, share };
      }
    }
  }
  return null;
}

function traceQuestion(
  definition: MaturityDefinition,
  question: ScorableQuestion,
  answer: AnswerValue | undefined
): QuestionTrace {
  const weight = severityWeight(question.severity);
  const weightedPoints = exactRatio(weight, 1);
  const base = {
    questionId: question.questionId,
    pillarId: question.pillarId,
    weight,
    practices: null,
  };
  const unanswered = (): QuestionTrace => ({
    ...base,
    state: "unanswered",
    exclusion: "unanswered",
    result: null,
    earned: serializeRatio(ZERO_RATIO),
    available: serializeRatio(weightedPoints),
  });
  const normalizedAnswer = normalizeQuestionAnswer(
    { type: question.type, practiceIds: question.practiceIds },
    answer
  );
  if (normalizedAnswer === null) {
    // AC-019: remains fully available and unearned while reducing coverage.
    return unanswered();
  }
  if (normalizedAnswer === "na") {
    // Whole-question N/A counts as answered and removes its full weight. A
    // checklist still reports every practice as N/A so downstream gap
    // projections cannot mistake unchecked items for explicit misses.
    return {
      ...base,
      practices:
        question.type === "checklist"
          ? question.practiceIds.map((practiceId) => ({
              practiceId,
              share: serializeRatio(
                practiceShare(definition, question, practiceId)
              ),
              state: "not-applicable" as const,
            }))
          : null,
      state: "not-applicable",
      exclusion: "question-na",
      result: null,
      earned: serializeRatio(ZERO_RATIO),
      available: serializeRatio(ZERO_RATIO),
    };
  }
  if (question.type === "yes-no") {
    const isMet = normalizedAnswer === "yes";
    const earned = isMet ? exactRatio(weight, 1) : ZERO_RATIO;
    return {
      ...base,
      state: "scored",
      exclusion: null,
      result: serializeRatio(exactRatio(isMet ? 1 : 0, 1)),
      earned: serializeRatio(earned),
      available: serializeRatio(weightedPoints),
    };
  }
  if (typeof normalizedAnswer === "string") return unanswered();
  const checked = new Set(normalizedAnswer.checked);
  const notApplicable = new Set(normalizedAnswer.na);
  const practices: PracticeTrace[] = question.practiceIds.map((practiceId) => ({
    practiceId,
    share: serializeRatio(practiceShare(definition, question, practiceId)),
    state: notApplicable.has(practiceId)
      ? "not-applicable"
      : checked.has(practiceId)
        ? "met"
        : "unmet",
  }));
  const applicable = question.practiceIds.filter(
    (practiceId) => !notApplicable.has(practiceId)
  );
  if (applicable.length === 0) {
    // AC-021: counts as answered, excluded from the maturity denominator.
    return {
      ...base,
      practices,
      state: "not-applicable",
      exclusion: "all-practices-na",
      result: null,
      earned: serializeRatio(ZERO_RATIO),
      available: serializeRatio(ZERO_RATIO),
    };
  }
  let metShare = ZERO_RATIO;
  let applicableShare = ZERO_RATIO;
  for (const practiceId of applicable) {
    const share = practiceShare(definition, question, practiceId);
    applicableShare = addExact(applicableShare, share);
    if (checked.has(practiceId)) {
      metShare = addExact(metShare, share);
    }
  }
  // AC-016/AC-020: report met share over applicable share, but remove an N/A
  // practice's exact weighted share from aggregate points without renormalizing.
  const result = divideExact(metShare, applicableShare);
  const earned = multiplyExact(weightedPoints, metShare);
  const available = multiplyExact(weightedPoints, applicableShare);
  return {
    ...base,
    practices,
    state: "scored",
    exclusion: null,
    result: serializeRatio(result),
    earned: serializeRatio(earned),
    available: serializeRatio(available),
  };
}

function buildPillars(
  questions: readonly QuestionTrace[],
  thresholds: StageThresholds
): PillarTrace[] {
  const byPillar = new Map<string, QuestionTrace[]>();
  for (const question of questions) {
    const list = byPillar.get(question.pillarId) ?? [];
    list.push(question);
    byPillar.set(question.pillarId, list);
  }
  const pillars: PillarTrace[] = [];
  for (const [pillarId, rows] of byPillar) {
    let earned = ZERO_RATIO;
    let available = ZERO_RATIO;
    let answered = 0;
    let hasScoredApplicableAnswer = false;
    for (const row of rows) {
      earned = addExact(earned, deserializeRatio(row.earned));
      available = addExact(available, deserializeRatio(row.available));
      if (row.state !== "unanswered") answered += 1;
      if (row.state === "scored") hasScoredApplicableAnswer = true;
    }
    const result = hasScoredApplicableAnswer
      ? divideExact(earned, available)
      : null;
    pillars.push({
      pillarId,
      earned: serializeRatio(earned),
      available: serializeRatio(available),
      result: result && serializeRatio(result),
      stage: result ? resolveStage(result, thresholds).stage : null,
      answered,
      unanswered: rows.length - answered,
      total: rows.length,
    });
  }
  return pillars;
}

/**
 * Calculates maturity for one pinned TemplateRevision. Pure and deterministic:
 * identical inputs always produce an identical trace.
 */
export function calculateMaturity(
  input: CalculateMaturityInput
): MaturityCalculation {
  const { templateRevisionId, definition, questions, answers } = input;
  if (questions.length > MAX_MATURITY_QUESTIONS) {
    return {
      kind: "configuration-error",
      code: "question-limit-exceeded",
      templateRevisionId,
      questionCount: questions.length,
      limit: MAX_MATURITY_QUESTIONS,
    };
  }
  const invalidShare = findNonPositiveCustomShare(definition, questions);
  if (invalidShare) {
    return {
      kind: "configuration-error",
      code: "non-positive-custom-share",
      templateRevisionId,
      ...invalidShare,
    };
  }

  const questionTraces = questions.map((question) =>
    traceQuestion(definition, question, answers[question.questionId])
  );
  const answered = questionTraces.filter(
    (trace) => trace.state !== "unanswered"
  ).length;
  const coverage: Coverage = {
    answered,
    unanswered: questions.length - answered,
    total: questions.length,
  };

  let earned = ZERO_RATIO;
  let available = ZERO_RATIO;
  let hasScoredApplicableAnswer = false;
  for (const trace of questionTraces) {
    earned = addExact(earned, deserializeRatio(trace.earned));
    available = addExact(available, deserializeRatio(trace.available));
    if (trace.state === "scored") hasScoredApplicableAnswer = true;
  }

  if (!hasScoredApplicableAnswer) {
    return {
      kind: "no-result",
      reason: "no-scored-applicable-answer",
      templateRevisionId,
      thresholds: definition.thresholds,
      questions: questionTraces,
      coverage,
    };
  }

  // AC-018: the template result uses questions directly, never pillar averages.
  const result = divideExact(earned, available);
  return {
    kind: "result",
    trace: {
      schemaVersion: CALCULATION_TRACE_SCHEMA_VERSION,
      templateRevisionId,
      thresholds: definition.thresholds,
      questions: questionTraces,
      pillars: buildPillars(questionTraces, definition.thresholds),
      earned: serializeRatio(earned),
      available: serializeRatio(available),
      result: serializeRatio(result),
      stage: resolveStage(result, definition.thresholds),
      coverage,
    },
  };
}

/** Deterministic serialization used by the byte-equivalence contract (AC-014, AC-054). */
export function serializeTrace(trace: CalculationTrace): string {
  return JSON.stringify(trace);
}
