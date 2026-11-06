import { describe, it, expect } from "vitest";
import { useAssessmentProgress } from "~/composables/assessment/useAssessmentProgress";
import type { Review } from "~/models";

describe("useAssessmentProgress", () => {
  const mockReview: Review = {
    id: "review-1",
    name: "Test Review",
    applicationId: "app-1",
    templateId: "tmpl-1",
    templateName: "Test Template",
    status: "in-progress",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    pillars: [
      {
        slug: "security",
        name: "Security",
        progress: 50,
        totalQuestions: 2,
        answeredQuestions: 1,
      },
      {
        slug: "reliability",
        name: "Reliability",
        progress: 100,
        totalQuestions: 2,
        answeredQuestions: 2,
      },
    ],
    assessors: [],
    reviewers: [],
  } satisfies Review;

  describe("calculateOverallProgress", () => {
    it("should calculate overall progress from pillars", () => {
      const { calculateOverallProgress } = useAssessmentProgress();
      const progress = calculateOverallProgress(mockReview.pillars);
      expect(progress).toBe(75); // (50 + 100) / 2
    });

    it("should return 0 for empty pillars", () => {
      const { calculateOverallProgress } = useAssessmentProgress();
      const progress = calculateOverallProgress([]);
      expect(progress).toBe(0);
    });
  });

  describe("getPillarProgress", () => {
    it("should calculate progress for a pillar", () => {
      const { getPillarProgress } = useAssessmentProgress();
      const progress = getPillarProgress(mockReview.pillars[0]);
      expect(progress).toBe(50); // 1 of 2 questions answered
    });

    it("should return 100 for fully answered pillar", () => {
      const { getPillarProgress } = useAssessmentProgress();
      const progress = getPillarProgress(mockReview.pillars[1]);
      expect(progress).toBe(100);
    });
  });

  describe("isComplete", () => {
    it("should return false for incomplete review", () => {
      const { isComplete } = useAssessmentProgress();
      expect(isComplete(mockReview)).toBe(false);
    });

    it("should return true for complete review", () => {
      const { isComplete } = useAssessmentProgress();
      const completeReview: Review = {
        ...mockReview,
        pillars: mockReview.pillars.map((p) => ({
          ...p,
          progress: 100,
          answeredQuestions: p.totalQuestions,
        })),
      };
      expect(isComplete(completeReview)).toBe(true);
    });
  });

  describe("getTotalQuestions", () => {
    it("should count total questions", () => {
      const { getTotalQuestions } = useAssessmentProgress();
      const total = getTotalQuestions(mockReview);
      expect(total).toBe(4); // 2 + 2
    });
  });
});
