import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssessmentMutate } from "~/composables/assessment/useAssessmentMutate";

vi.mock("~/services/entity/AnswerMutations", () => ({
  answerMutations: {
    save: vi.fn().mockResolvedValue(undefined),
    recordRemoteHistory: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("~/services/entity/NoteMutations", () => ({
  noteMutations: {
    save: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("~/composables/useLocalProgress", () => ({
  saveLocalProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/services/entity/ReviewMutations", () => ({
  reviewMutations: {
    saveMilestone: vi.fn().mockResolvedValue("evt_milestone"),
  },
}));

describe("useAssessmentMutate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return saving, error, saveAnswer, and saveProgress", () => {
    const { saving, error, saveAnswer, saveProgress, createMilestone } =
      useAssessmentMutate("review-1", "revision-1");
    expect(saving.value).toBe(false);
    expect(error.value).toBeNull();
    expect(typeof saveAnswer).toBe("function");
    expect(typeof saveProgress).toBe("function");
    expect(typeof createMilestone).toBe("function");
  });

  it("should accept reactive reviewId", () => {
    const reviewId = ref("review-1");
    const { saving } = useAssessmentMutate(reviewId, "revision-1");
    expect(saving.value).toBe(false);
  });

  it("falls back to the review API when a remote-only review has no local selection", async () => {
    const { answerMutations } =
      await import("~/services/entity/AnswerMutations");
    vi.mocked(answerMutations.save).mockRejectedValueOnce(
      new Error("Template Revision is not selected by this Review")
    );
    const fetchSpy = vi.fn().mockResolvedValue({ success: true });
    vi.stubGlobal("$fetch", fetchSpy);
    const { saveAnswer } = useAssessmentMutate("review-1", "revision-1");

    const ok = await saveAnswer("question-1", "yes");

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith("/api/reviews/review-1/answers", {
      method: "POST",
      body: {
        templateRevisionId: "revision-1",
        questionId: "question-1",
        answer: "yes",
        naReason: undefined,
        itemNAReasons: undefined,
      },
    });
    expect(answerMutations.recordRemoteHistory).toHaveBeenCalledWith({
      reviewId: "review-1",
      questionId: "question-1",
      answer: "yes",
    });
  });

  it("uses an explicit Revision when Survey crosses Template boundaries", async () => {
    const { answerMutations } =
      await import("~/services/entity/AnswerMutations");
    const { saveAnswer } = useAssessmentMutate("review-1", "revision-1");

    await saveAnswer("question-2", "yes", {
      templateRevisionId: "revision-2",
    });

    expect(answerMutations.save).toHaveBeenCalledWith(
      expect.objectContaining({ templateRevisionId: "revision-2" })
    );
  });

  it("creates local milestones without remote calls", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("$fetch", fetchSpy);

    const { createMilestone } = useAssessmentMutate("review-1", "revision-1");

    const { reviewMutations } =
      await import("~/services/entity/ReviewMutations");

    const ok = await createMilestone({
      templateId: "template-001",
      comment: "Milestone",
      snapshot: {
        overallProgress: 50,
        pillars: [],
      },
      delta: {
        questionsAnswered: 2,
        questionsChanged: 1,
        progressDelta: 50,
      },
    });

    expect(ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(reviewMutations.saveMilestone).toHaveBeenCalled();
  });

  it("returns false when local milestone persistence fails", async () => {
    const { reviewMutations } =
      await import("~/services/entity/ReviewMutations");
    vi.mocked(reviewMutations.saveMilestone).mockRejectedValueOnce(
      new Error("milestone failed")
    );

    const { createMilestone } = useAssessmentMutate("review-1", "revision-1");

    const ok = await createMilestone({
      templateId: "template-001",
      comment: "Milestone",
      snapshot: {
        overallProgress: 50,
        pillars: [],
      },
      delta: {
        questionsAnswered: 2,
        questionsChanged: 1,
        progressDelta: 50,
      },
    });

    expect(ok).toBe(false);
  });
});
