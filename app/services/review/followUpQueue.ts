import type { RiskLevel } from "~/models/template";
import type {
  FollowUpBuckets,
  FollowUpStagePractice,
  StagePathQuestionInfo,
} from "~/services/maturity/stagePath";

export type FollowUpRelation = "earlier" | "current" | "later";

export interface FollowUpQueuePractice extends FollowUpStagePractice {
  readonly relation: FollowUpRelation;
}

export interface FollowUpQueueQuestion {
  readonly questionId: string;
  readonly questionReference: string | null;
  readonly questionText: string;
  readonly pillarId: string;
  readonly pillarName: string;
  readonly severity: RiskLevel;
  readonly practices: readonly FollowUpQueuePractice[];
}

export interface FollowUpQueueSection {
  readonly severity: RiskLevel;
  readonly questions: readonly FollowUpQueueQuestion[];
  readonly practiceCount: number;
}

export interface UnansweredQueueQuestion {
  readonly questionId: string;
  readonly questionReference: string | null;
  readonly questionText: string;
  readonly pillarId: string;
  readonly pillarName: string;
  readonly severity: RiskLevel;
}

export interface FollowUpQueue {
  readonly sections: readonly FollowUpQueueSection[];
  readonly unanswered: readonly UnansweredQueueQuestion[];
}

const SEVERITY_ORDER: readonly RiskLevel[] = ["critical", "high", "medium"];
const RELATIONS: readonly FollowUpRelation[] = ["earlier", "current", "later"];

export function buildFollowUpQueue(
  buckets: FollowUpBuckets,
  questions: ReadonlyMap<string, StagePathQuestionInfo>
): FollowUpQueue {
  const questionOrder = new Map(
    [...questions.keys()].map((questionId, index) => [questionId, index])
  );
  const explicit = new Map<string, FollowUpQueuePractice[]>();

  for (const relation of RELATIONS) {
    for (const item of buckets[relation]) {
      const items = explicit.get(item.practice.questionId) ?? [];
      items.push({ ...item, relation });
      explicit.set(item.practice.questionId, items);
    }
  }

  const queueQuestions = [...explicit.entries()]
    .map(([questionId, practices]): FollowUpQueueQuestion => {
      const info = questions.get(questionId);
      const first = practices[0]!;
      return {
        questionId,
        questionReference: info?.questionReference ?? null,
        questionText: info?.text ?? first.practice.questionText,
        pillarId: info?.pillarId ?? first.practice.pillarId,
        pillarName: info?.pillarName ?? first.practice.pillarName,
        severity: info?.severity ?? first.practice.severity,
        practices,
      };
    })
    .toSorted(
      (left, right) =>
        (questionOrder.get(left.questionId) ?? Number.MAX_SAFE_INTEGER) -
        (questionOrder.get(right.questionId) ?? Number.MAX_SAFE_INTEGER)
    );

  const sections = SEVERITY_ORDER.map((severity) => {
    const sectionQuestions = queueQuestions.filter(
      (question) => question.severity === severity
    );
    return {
      severity,
      questions: sectionQuestions,
      practiceCount: sectionQuestions.reduce(
        (count, question) => count + question.practices.length,
        0
      ),
    };
  }).filter((section) => section.questions.length > 0);

  const unansweredIds = new Set(
    buckets.notAssessed.map((item) => item.practice.questionId)
  );
  const unanswered = [...questions.values()]
    .filter((question) => unansweredIds.has(question.questionId))
    .map(
      (question): UnansweredQueueQuestion => ({
        questionId: question.questionId,
        questionReference: question.questionReference,
        questionText: question.text,
        pillarId: question.pillarId,
        pillarName: question.pillarName,
        severity: question.severity,
      })
    );

  return { sections, unanswered };
}
