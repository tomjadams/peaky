import { describe, expect, it } from "vitest";
import type { HandoffPracticeRecord } from "~/services/handoff/draft";
import {
  LocalHandoffLifecycleError,
  localHandoffId,
  localHandoffReferenceFromId,
  projectLocalHandoffAnalytics,
  resolveActiveLocalHandoff,
  resolveActiveOrNextLocalHandoff,
  resolveSelectedHandoffPractices,
  type LocalReviewHandoffRecord,
} from "~/services/handoff/localLifecycle";

const NOW = "2026-09-02T20:00:00.000Z";

function handoff(
  sequence: number,
  status: "active" | "completed" = "active"
): LocalReviewHandoffRecord {
  const completed = status === "completed";
  return {
    id: localHandoffId("review-1", sequence),
    reviewId: "review-1",
    sequence,
    status,
    createdAt: NOW,
    createdBy: "actor-1",
    completedAt: completed ? "2026-09-02T21:30:00.000Z" : null,
    completionMode: completed ? "manual" : null,
    completedBy: completed ? "actor-2" : null,
    note: completed ? "Demo completed." : null,
    selectedPracticeIds: completed ? ["practice-1"] : [],
    unresolvedCount: completed ? 1 : null,
  };
}

function practice(
  practiceId: string,
  questionId: string,
  orderKey: string
): HandoffPracticeRecord {
  return {
    id: `practice-${practiceId}`,
    reference: {
      reviewId: "review-1",
      templateRevisionId: "rev-1",
      questionId,
      practiceId,
    },
    orderKey,
    snapshot: {
      title: practiceId,
      questionText: questionId,
      pillarName: "Reliability",
      templateName: "ORR",
      evidenceState: "unmet",
      leadingPractices: [],
      helpfulLinks: [],
      evidenceIdentifiers: [],
    },
    rationale: null,
    selectionState: "selected",
    localHandoffId: localHandoffId("review-1", 1),
    actorId: "actor-1",
    occurredAt: NOW,
    updatedAt: NOW,
  };
}

describe("local handoff lifecycle", () => {
  it("uses stable review and sequence identities", () => {
    const id = localHandoffId("review-1", 3);
    expect(id).toBe("review_handoff:review-1/3");
    expect(localHandoffReferenceFromId(id)).toEqual({
      reviewId: "review-1",
      sequence: 3,
    });
  });

  it("resolves one active handoff and rejects corrupt multiple-active state", () => {
    expect(resolveActiveLocalHandoff([handoff(1)], "review-1")?.sequence).toBe(
      1
    );
    expect(() =>
      resolveActiveLocalHandoff([handoff(1), handoff(2)], "review-1")
    ).toThrowError(LocalHandoffLifecycleError);
  });

  it("plans the next sequence only after the prior handoff completed", () => {
    const next = resolveActiveOrNextLocalHandoff({
      handoffs: [handoff(1, "completed")],
      reviewId: "review-1",
      createdAt: "2026-09-03T08:00:00.000Z",
      createdBy: "actor-3",
    });

    expect(next.isNew).toBe(true);
    expect(next.handoff).toMatchObject({ sequence: 2, status: "active" });
  });

  it("auto-completes only when every selected practice is met or not counted", () => {
    const rows = [
      practice("Q-YN", "Q-YN", "a"),
      practice("P1", "Q-CL", "b"),
      practice("P2", "Q-CL", "c"),
    ];
    const resolution = resolveSelectedHandoffPractices(rows, [
      { questionId: "Q-YN", answer: "yes" },
      {
        questionId: "Q-CL",
        answer: { checked: ["P1"], na: ["P2"] },
      },
    ]);

    expect(resolution.unresolvedCount).toBe(0);
    expect(resolution.canCompleteAutomatically).toBe(true);
    expect(resolution.practices.map((item) => item.state)).toEqual([
      "met",
      "met",
      "not-applicable",
    ]);
    expect(
      resolveSelectedHandoffPractices([], []).canCompleteAutomatically
    ).toBe(false);
  });

  it("projects duration and completion context for local reporting", () => {
    expect(projectLocalHandoffAnalytics(handoff(1, "completed"))).toMatchObject(
      {
        sequence: 1,
        durationMs: 5_400_000,
        unresolvedCount: 1,
        note: "Demo completed.",
      }
    );
  });
});
