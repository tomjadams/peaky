import type {
  CalculationTrace,
  PillarTrace,
  QuestionTrace,
  ResolvedStage,
} from "~/services/maturity/calculate";
import { describeStage } from "~/services/maturity/calculate";
import { deserializeRatio, toWholePercent } from "~/services/maturity/ratio";

/** Human-readable question fields supplied by the caller's workspace index. */
export interface PillarQuestionDisplayInfo {
  readonly questionId: string;
  readonly questionReference: string | null;
  readonly text: string;
  readonly practices?: readonly {
    readonly id: string;
    readonly text: string;
  }[];
}

export type PillarQuestionAnswerStatus =
  | "answered"
  | "unanswered"
  | "not-applicable";

export type PillarQuestionContributionState =
  | "fully-contributing"
  | "partially-contributing"
  | "not-contributing-yet"
  | "unanswered"
  | "not-counted";

export interface PillarQuestionPracticeRow {
  readonly id: string;
  readonly title: string;
  readonly state: "met" | "unmet" | "not-applicable";
  readonly stateLabel: string;
}

export interface PillarQuestionBreakdownRow {
  /** Opaque trace identity, copied exactly and never parsed. */
  readonly questionId: string;
  readonly questionReference: string | null;
  readonly title: string;
  readonly answerStatus: PillarQuestionAnswerStatus;
  readonly answerStatusLabel: string;
  /** The question's own evidence result. Null means the trace did not score it. */
  readonly evidenceCompletionPercent: number | null;
  readonly contributionState: PillarQuestionContributionState;
  readonly contributionLabel: string;
  readonly contributionDetail: string;
  readonly practices: readonly PillarQuestionPracticeRow[];
  /** The original trace object, retained for exact identity and auditability. */
  readonly trace: QuestionTrace;
}

export interface PillarQuestionBreakdown {
  readonly pillarId: string;
  readonly displayPercent: number | null;
  readonly stage: ResolvedStage | null;
  readonly answered: number;
  readonly unanswered: number;
  readonly total: number;
  readonly questions: readonly PillarQuestionBreakdownRow[];
  /** The original pillar trace, retained rather than reconstructed. */
  readonly trace: PillarTrace;
}

function answerStatus(question: QuestionTrace): {
  status: PillarQuestionAnswerStatus;
  label: string;
} {
  if (question.state === "unanswered") {
    return { status: "unanswered", label: "Unanswered" };
  }
  if (question.state === "not-applicable") {
    return { status: "not-applicable", label: "Not applicable" };
  }
  return { status: "answered", label: "Answered" };
}

function contributionState(question: QuestionTrace): {
  state: PillarQuestionContributionState;
  label: string;
  detail: string;
} {
  if (question.state === "unanswered") {
    return {
      state: "unanswered",
      label: "No answer recorded",
      detail:
        "No answer is recorded, so this question currently earns no evidence.",
    };
  }
  if (question.state === "not-applicable") {
    return {
      state: "not-counted",
      label: "Not counted",
      detail: "This question is excluded from the pillar result.",
    };
  }

  const earned = deserializeRatio(question.earned);
  const available = deserializeRatio(question.available);
  const earnedEqualsAvailable =
    earned.numerator * available.denominator ===
    available.numerator * earned.denominator;
  if (earnedEqualsAvailable) {
    return {
      state: "fully-contributing",
      label: "All available evidence earned",
      detail: "The recorded answer earns all of this question's evidence.",
    };
  }
  if (earned.numerator > 0n) {
    return {
      state: "partially-contributing",
      label: "Partial evidence earned",
      detail:
        "The recorded answer earns some, but not all, of this question's evidence.",
    };
  }
  return {
    state: "not-contributing-yet",
    label: "No maturity evidence earned",
    detail: "The recorded answer does not currently add to this pillar result.",
  };
}

function practiceStateLabel(state: PillarQuestionPracticeRow["state"]): string {
  if (state === "met") return "Met";
  if (state === "not-applicable") return "Not counted";
  return "Needs follow-up";
}

/**
 * Projects one pillar's complete question list from the existing calculation
 * trace. It never recalculates answers, weights, pillar results, or stages.
 */
export function projectPillarQuestions(input: {
  readonly trace: CalculationTrace;
  readonly pillarId: string;
  readonly questions: ReadonlyMap<string, PillarQuestionDisplayInfo>;
}): PillarQuestionBreakdown | null {
  const { trace, pillarId, questions } = input;
  const pillar = trace.pillars.find(
    (candidate) => candidate.pillarId === pillarId
  );
  if (!pillar) return null;

  const rows = trace.questions
    .filter((question) => question.pillarId === pillarId)
    .map((question): PillarQuestionBreakdownRow => {
      const display = questions.get(question.questionId);
      const answer = answerStatus(question);
      const contribution = contributionState(question);
      return {
        questionId: question.questionId,
        questionReference: display?.questionReference ?? null,
        title: display?.text ?? "Question details unavailable",
        answerStatus: answer.status,
        answerStatusLabel: answer.label,
        evidenceCompletionPercent: question.result
          ? toWholePercent(deserializeRatio(question.result))
          : null,
        contributionState: contribution.state,
        contributionLabel: contribution.label,
        contributionDetail: contribution.detail,
        practices: (question.practices ?? []).map((practice) => ({
          id: practice.practiceId,
          title:
            display?.practices?.find(
              (candidate) => candidate.id === practice.practiceId
            )?.text ?? practice.practiceId,
          state: practice.state,
          stateLabel: practiceStateLabel(practice.state),
        })),
        trace: question,
      };
    });

  return {
    pillarId: pillar.pillarId,
    displayPercent: pillar.result
      ? toWholePercent(deserializeRatio(pillar.result))
      : null,
    stage:
      pillar.stage === null
        ? null
        : describeStage(pillar.stage, trace.thresholds),
    answered: pillar.answered,
    unanswered: pillar.unanswered,
    total: pillar.total,
    questions: rows,
    trace: pillar,
  };
}
