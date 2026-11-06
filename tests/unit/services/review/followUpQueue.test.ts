import { describe, expect, it } from "vitest";
import { buildFollowUpQueue } from "~/services/review/followUpQueue";
import type {
  FollowUpBuckets,
  FollowUpStagePractice,
  StagePathQuestionInfo,
} from "~/services/maturity/stagePath";

const questions = new Map<string, StagePathQuestionInfo>([
  [
    "q-medium",
    {
      questionId: "q-medium",
      questionReference: "REL-2",
      pillarId: "p-rel",
      pillarName: "Reliability",
      text: "Medium question",
      type: "checklist",
      severity: "medium",
      practices: [],
    },
  ],
  [
    "q-critical",
    {
      questionId: "q-critical",
      questionReference: "REL-1",
      pillarId: "p-rel",
      pillarName: "Reliability",
      text: "Critical question",
      type: "yes-no",
      severity: "critical",
      practices: [],
    },
  ],
  [
    "q-unanswered",
    {
      questionId: "q-unanswered",
      questionReference: "OPS-1",
      pillarId: "p-ops",
      pillarName: "Operations",
      text: "Unanswered checklist",
      type: "checklist",
      severity: "high",
      practices: [],
    },
  ],
]);

function item(
  questionId: string,
  practiceId: string,
  stage: 1 | 2 | 3 | 4 | 5,
  state: "unmet" | "unknown" = "unmet"
): FollowUpStagePractice {
  const question = questions.get(questionId)!;
  return {
    stage,
    stageName: `Stage ${stage}`,
    practice: {
      questionId,
      practiceId,
      questionText: question.text,
      practiceText: practiceId,
      pillarId: question.pillarId,
      pillarName: question.pillarName,
      state,
      severity: question.severity,
      guidance: null,
    },
  };
}

const buckets: FollowUpBuckets = {
  earlier: [item("q-medium", "practice-a", 1)],
  current: [item("q-critical", "q-critical", 3)],
  later: [item("q-medium", "practice-b", 5)],
  notAssessed: [
    item("q-unanswered", "practice-u1", 2, "unknown"),
    item("q-unanswered", "practice-u2", 2, "unknown"),
  ],
};

describe("buildFollowUpQueue", () => {
  it("groups explicit gaps by severity while retaining placement per practice", () => {
    const queue = buildFollowUpQueue(buckets, questions);

    expect(queue.sections.map((section) => section.severity)).toEqual([
      "critical",
      "medium",
    ]);
    expect(queue.sections[0]!.questions[0]!.questionId).toBe("q-critical");
    expect(queue.sections[1]!.questions[0]!.practices).toMatchObject([
      { relation: "earlier", stage: 1 },
      { relation: "later", stage: 5 },
    ]);
  });

  it("projects unanswered evidence once per source question", () => {
    const queue = buildFollowUpQueue(buckets, questions);

    expect(queue.unanswered).toHaveLength(1);
    expect(queue.unanswered[0]).toMatchObject({
      questionId: "q-unanswered",
      questionText: "Unanswered checklist",
      pillarName: "Operations",
    });
  });
});
