/**
 * Exact maturity preview for selected handoff practices from one pinned
 * TemplateRevision.
 *
 * The projection reads only a CalculationTrace and exact practice identities.
 * It does not recalculate answers, mutate the trace, or combine Revisions.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import {
  resolveStage,
  type CalculationTrace,
  type QuestionTrace,
  type ResolvedStage,
} from "./calculate";
import {
  addExact,
  compareExact,
  deserializeRatio,
  divideExact,
  exactRatio,
  multiplyExact,
  serializeRatio,
  subtractExact,
  toTenthsPercent,
  toWholePercent,
  ZERO_RATIO,
  type ExactRatio,
  type SerializedRatio,
} from "./ratio";

/** Structural subset accepted directly from a handoff PracticeReference. */
export interface HandoffPreviewPracticeReference {
  readonly templateRevisionId: string;
  readonly questionId: string;
  readonly practiceId: string;
}

export interface PreviewMaturityScore {
  readonly earned: SerializedRatio;
  readonly available: SerializedRatio;
  readonly result: SerializedRatio;
  readonly displayPercent: number;
  readonly displayPercentTenths: number;
  readonly stage: ResolvedStage;
}

export interface PracticeMaturityOpportunity {
  readonly reference: HandoffPreviewPracticeReference;
  /** Exact weighted points added when this practice is completed. */
  readonly weightedPoints: SerializedRatio;
  /** Exact percentage-point contribution before display rounding. */
  readonly percentagePoints: SerializedRatio;
  /** Percentage points rounded to one decimal for compact copy such as `+0.7 pts`. */
  readonly displayPercentagePoints: number;
}

export interface MaturityPreviewDelta {
  /** Actual weighted-point gain after the projected earned total is clamped. */
  readonly weightedPoints: SerializedRatio;
  /** Exact change in score as a 0 through 1 ratio. */
  readonly result: SerializedRatio;
  /** Exact score change expressed in percentage points. */
  readonly percentagePoints: SerializedRatio;
  /** Exact score movement rounded to one decimal percentage point. */
  readonly displayPercentagePoints: number;
}

export interface MaturityPointsStillNeeded {
  /** Exact weighted points needed to enter the next stage. */
  readonly weightedPoints: SerializedRatio;
  /** Exact distance to the next stage boundary in percentage points. */
  readonly percentagePoints: SerializedRatio;
  /** Distance to the next stage boundary rounded to one decimal point. */
  readonly displayPercentagePoints: number;
}

export interface HandoffMaturityPreview {
  readonly kind: "available";
  readonly templateRevisionId: string;
  readonly selectedCount: number;
  readonly current: PreviewMaturityScore;
  readonly projected: PreviewMaturityScore;
  readonly delta: MaturityPreviewDelta;
  /** Whole-percent boundary after the projected stage, or null at stage 5. */
  readonly nextThreshold: number | null;
  readonly pointsStillNeeded: MaturityPointsStillNeeded | null;
  readonly crossesStage: boolean;
  readonly practiceOpportunities: readonly PracticeMaturityOpportunity[];
}

export type HandoffMaturityPreviewUnavailableReason =
  | "zero-available-points"
  | "template-revision-mismatch"
  | "selection-not-found"
  | "selection-not-unmet"
  | "duplicate-selection";

export interface HandoffMaturityPreviewUnavailable {
  readonly kind: "unavailable";
  readonly templateRevisionId: string;
  readonly selectedCount: number;
  readonly reason: HandoffMaturityPreviewUnavailableReason;
  /** The offending selection, or null when the trace has no denominator. */
  readonly selection: HandoffPreviewPracticeReference | null;
  readonly selectionIndex: number | null;
}

export type HandoffMaturityPreviewResult =
  | HandoffMaturityPreview
  | HandoffMaturityPreviewUnavailable;

export interface PreviewHandoffMaturityInput {
  readonly trace: CalculationTrace;
  readonly selectedPractices: readonly HandoffPreviewPracticeReference[];
}

interface ResolvedSelection {
  readonly reference: HandoffPreviewPracticeReference;
  readonly weightedPoints: ExactRatio;
}

interface UnavailableSelection {
  readonly reason: Exclude<
    HandoffMaturityPreviewUnavailableReason,
    "zero-available-points" | "duplicate-selection"
  >;
}

const HUNDRED = exactRatio(100, 1);

function asPercentagePoints(scoreRatio: ExactRatio): ExactRatio {
  return multiplyExact(scoreRatio, HUNDRED);
}

function isExplicitUnmetYesNo(question: QuestionTrace): boolean {
  return (
    question.state === "scored" &&
    question.result !== null &&
    deserializeRatio(question.result).numerator === 0n
  );
}

function resolveSelection(
  trace: CalculationTrace,
  reference: HandoffPreviewPracticeReference
): ResolvedSelection | UnavailableSelection {
  if (reference.templateRevisionId !== trace.templateRevisionId) {
    return { reason: "template-revision-mismatch" };
  }
  const question = trace.questions.find(
    (candidate) => candidate.questionId === reference.questionId
  );
  if (!question) return { reason: "selection-not-found" };

  if (question.practices === null) {
    if (reference.practiceId !== question.questionId) {
      return { reason: "selection-not-found" };
    }
    if (!isExplicitUnmetYesNo(question)) {
      return { reason: "selection-not-unmet" };
    }
    return {
      reference,
      weightedPoints: deserializeRatio(question.available),
    };
  }

  const practice = question.practices.find(
    (candidate) => candidate.practiceId === reference.practiceId
  );
  if (!practice) return { reason: "selection-not-found" };
  if (question.state !== "scored" || practice.state !== "unmet") {
    return { reason: "selection-not-unmet" };
  }
  return {
    reference,
    weightedPoints: multiplyExact(
      exactRatio(question.weight, 1),
      deserializeRatio(practice.share)
    ),
  };
}

function selectionKey(reference: HandoffPreviewPracticeReference): string {
  return JSON.stringify([
    reference.templateRevisionId,
    reference.questionId,
    reference.practiceId,
  ]);
}

function unavailable(input: {
  trace: CalculationTrace;
  selectedCount: number;
  reason: HandoffMaturityPreviewUnavailableReason;
  selection: HandoffPreviewPracticeReference | null;
  selectionIndex: number | null;
}): HandoffMaturityPreviewUnavailable {
  return {
    kind: "unavailable",
    templateRevisionId: input.trace.templateRevisionId,
    selectedCount: input.selectedCount,
    reason: input.reason,
    selection: input.selection,
    selectionIndex: input.selectionIndex,
  };
}

function nextThresholdFor(
  stage: ResolvedStage,
  trace: CalculationTrace
): number | null {
  return stage.stage === 5 ? null : trace.thresholds[stage.stage - 1]!;
}

/**
 * Projects the exact maturity result if every selected explicit gap from one
 * Revision becomes met. Any invalid selection makes the whole preview
 * unavailable so a stale or mixed-Revision draft cannot produce a partial
 * score.
 */
export function previewHandoffMaturity(
  input: PreviewHandoffMaturityInput
): HandoffMaturityPreviewResult {
  const { trace, selectedPractices } = input;
  const available = deserializeRatio(trace.available);
  if (available.numerator === 0n) {
    return unavailable({
      trace,
      selectedCount: selectedPractices.length,
      reason: "zero-available-points",
      selection: null,
      selectionIndex: null,
    });
  }

  const seen = new Set<string>();
  const resolved: ResolvedSelection[] = [];
  for (const [index, reference] of selectedPractices.entries()) {
    const key = selectionKey(reference);
    if (seen.has(key)) {
      return unavailable({
        trace,
        selectedCount: selectedPractices.length,
        reason: "duplicate-selection",
        selection: reference,
        selectionIndex: index,
      });
    }
    seen.add(key);

    const selection = resolveSelection(trace, reference);
    if ("reason" in selection) {
      return unavailable({
        trace,
        selectedCount: selectedPractices.length,
        reason: selection.reason,
        selection: reference,
        selectionIndex: index,
      });
    }
    resolved.push(selection);
  }

  let selectedWeightedPoints = ZERO_RATIO;
  const practiceOpportunities = resolved.map((selection) => {
    selectedWeightedPoints = addExact(
      selectedWeightedPoints,
      selection.weightedPoints
    );
    const resultOpportunity = divideExact(selection.weightedPoints, available);
    return {
      reference: selection.reference,
      weightedPoints: serializeRatio(selection.weightedPoints),
      percentagePoints: serializeRatio(asPercentagePoints(resultOpportunity)),
      displayPercentagePoints: toTenthsPercent(resultOpportunity),
    } satisfies PracticeMaturityOpportunity;
  });

  const currentEarned = deserializeRatio(trace.earned);
  const unclampedProjectedEarned = addExact(
    currentEarned,
    selectedWeightedPoints
  );
  const projectedEarned =
    compareExact(unclampedProjectedEarned, available) > 0
      ? available
      : unclampedProjectedEarned;
  const projectedResult = divideExact(projectedEarned, available);
  const projectedStage = resolveStage(projectedResult, trace.thresholds);
  const currentResult = deserializeRatio(trace.result);
  const currentDisplayPercent = toWholePercent(currentResult);
  const projectedDisplayPercent = toWholePercent(projectedResult);
  const resultDelta = subtractExact(projectedResult, currentResult);
  const earnedDelta = subtractExact(projectedEarned, currentEarned);
  const nextThreshold = nextThresholdFor(projectedStage, trace);
  const scoreStillNeeded =
    nextThreshold === null
      ? null
      : subtractExact(exactRatio(nextThreshold, 100), projectedResult);

  return {
    kind: "available",
    templateRevisionId: trace.templateRevisionId,
    selectedCount: selectedPractices.length,
    current: {
      earned: trace.earned,
      available: trace.available,
      result: trace.result,
      displayPercent: currentDisplayPercent,
      displayPercentTenths: toTenthsPercent(currentResult),
      stage: trace.stage,
    },
    projected: {
      earned: serializeRatio(projectedEarned),
      available: trace.available,
      result: serializeRatio(projectedResult),
      displayPercent: projectedDisplayPercent,
      displayPercentTenths: toTenthsPercent(projectedResult),
      stage: projectedStage,
    },
    delta: {
      weightedPoints: serializeRatio(earnedDelta),
      result: serializeRatio(resultDelta),
      percentagePoints: serializeRatio(asPercentagePoints(resultDelta)),
      displayPercentagePoints: toTenthsPercent(resultDelta),
    },
    nextThreshold,
    pointsStillNeeded:
      scoreStillNeeded === null
        ? null
        : {
            weightedPoints: serializeRatio(
              multiplyExact(available, scoreStillNeeded)
            ),
            percentagePoints: serializeRatio(
              asPercentagePoints(scoreStillNeeded)
            ),
            displayPercentagePoints: toTenthsPercent(scoreStillNeeded),
          },
    crossesStage: projectedStage.stage > trace.stage.stage,
    practiceOpportunities,
  };
}
