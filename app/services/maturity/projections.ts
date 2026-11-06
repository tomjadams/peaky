/**
 * Explanation and pillar projections over the calculation trace
 * (maturity-score/REQ-014, REQ-015). Every view derives from the returned
 * trace — never from a second calculation.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import {
  compareToPercent,
  deserializeRatio,
  exactRatio,
  toWholePercent,
  addExact,
  serializeRatio,
  ZERO_RATIO,
  type SerializedRatio,
} from "./ratio";
import type {
  CalculationTrace,
  Coverage,
  QuestionTrace,
  ResolvedStage,
} from "./calculate";
import type { StageThresholds } from "./stages";

export interface BoundaryStraddle {
  /** The pinned threshold the whole-percent display appears to cross. */
  readonly boundary: number;
  readonly displayPercent: number;
}

export interface RemainderSummary {
  readonly count: number;
  readonly earned: SerializedRatio;
  readonly available: SerializedRatio;
}

export interface ExplanationView {
  readonly templateRevisionId: string;
  /** The exact unrounded result used for stage resolution (AC-024, AC-035). */
  readonly exactResult: SerializedRatio;
  /** Whole-percent display value, rounded at the display boundary only. */
  readonly displayPercent: number;
  readonly stage: ResolvedStage;
  readonly thresholds: StageThresholds;
  readonly coverage: Coverage;
  readonly earned: SerializedRatio;
  readonly available: SerializedRatio;
  /**
   * Set when whole-number display appears to cross a pinned boundary the exact
   * ratio does not (or vice versa); the explanation states why (AC-035).
   */
  readonly boundaryStraddle: BoundaryStraddle | null;
  /** Every question row — the complete denominator, not a sample (AC-029). */
  readonly questions: readonly QuestionTrace[];
  readonly pillars: CalculationTrace["pillars"];
  /**
   * Splits the trace into displayed rows plus an explicit summarized remainder
   * so a representative-row UI can never become the denominator (AC-029).
   */
  summarizeRemainder(shownQuestionIds: readonly string[]): {
    shown: QuestionTrace[];
    remainder: RemainderSummary | null;
  };
}

function detectBoundaryStraddle(
  trace: CalculationTrace,
  displayPercent: number
): BoundaryStraddle | null {
  const exact = deserializeRatio(trace.result);
  const displayed = exactRatio(displayPercent, 100);
  for (const boundary of trace.thresholds) {
    const exactSide = compareToPercent(exact, boundary) >= 0;
    const displaySide = compareToPercent(displayed, boundary) >= 0;
    if (exactSide !== displaySide) {
      return { boundary, displayPercent };
    }
  }
  return null;
}

/** AC-028: the explanation renders straight from the trace. */
export function explainCalculation(trace: CalculationTrace): ExplanationView {
  const displayPercent = toWholePercent(deserializeRatio(trace.result));
  return {
    templateRevisionId: trace.templateRevisionId,
    exactResult: trace.result,
    displayPercent,
    stage: trace.stage,
    thresholds: trace.thresholds,
    coverage: trace.coverage,
    earned: trace.earned,
    available: trace.available,
    boundaryStraddle: detectBoundaryStraddle(trace, displayPercent),
    questions: trace.questions,
    pillars: trace.pillars,
    summarizeRemainder(shownQuestionIds: readonly string[]) {
      const shownSet = new Set(shownQuestionIds);
      const shown = trace.questions.filter((question) =>
        shownSet.has(question.questionId)
      );
      const rest = trace.questions.filter(
        (question) => !shownSet.has(question.questionId)
      );
      if (rest.length === 0) {
        return { shown, remainder: null };
      }
      let earned = ZERO_RATIO;
      let available = ZERO_RATIO;
      for (const question of rest) {
        earned = addExact(earned, deserializeRatio(question.earned));
        available = addExact(available, deserializeRatio(question.available));
      }
      return {
        shown,
        remainder: {
          count: rest.length,
          earned: serializeRatio(earned),
          available: serializeRatio(available),
        },
      };
    },
  };
}

export interface PillarBreakdownRow {
  readonly pillarId: string;
  readonly result: SerializedRatio | null;
  readonly displayPercent: number | null;
  readonly stage: number | null;
  readonly answered: number;
  readonly unanswered: number;
  readonly total: number;
}

/** AC-026: pillar rows are explanatory — percentage, stage, coverage, unanswered. */
export function buildPillarBreakdown(
  trace: CalculationTrace
): PillarBreakdownRow[] {
  return trace.pillars.map((pillar) => ({
    pillarId: pillar.pillarId,
    result: pillar.result,
    displayPercent: pillar.result
      ? toWholePercent(deserializeRatio(pillar.result))
      : null,
    stage: pillar.stage,
    answered: pillar.answered,
    unanswered: pillar.unanswered,
    total: pillar.total,
  }));
}
