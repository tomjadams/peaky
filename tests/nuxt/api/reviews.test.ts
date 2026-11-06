import { describe, it, expect } from "vitest";
import { reviews } from "../../../server/data/reviews";
import { questions } from "../../../server/data/questions";

// NOTE: mostly testing test setup, we'll use MSW for functional testing later
describe("Reviews Data", () => {
  describe("reviews data structure", () => {
    it("has valid review entries", () => {
      expect(reviews.length).toBeGreaterThan(0);
    });

    it("reviews have required fields", () => {
      const review = reviews[0];
      expect(review).toHaveProperty("id");
      expect(review).toHaveProperty("name");
      expect(review).toHaveProperty("templateId");
      expect(review).toHaveProperty("templateName");
      expect(review).toHaveProperty("status");
      expect(review).toHaveProperty("createdAt");
      expect(review).toHaveProperty("updatedAt");
      expect(review).toHaveProperty("pillars");
    });

    it("review status is valid", () => {
      reviews.forEach((review) => {
        expect(["draft", "in-progress", "completed", "archived"]).toContain(
          review.status
        );
      });
    });

    it("review pillars have required fields", () => {
      const review = reviews[0];
      expect(review).toBeDefined();
      expect(Array.isArray(review!.pillars)).toBe(true);
      review!.pillars.forEach((pillar) => {
        expect(pillar).toHaveProperty("slug");
        expect(pillar).toHaveProperty("name");
        expect(pillar).toHaveProperty("progress");
        expect(pillar).toHaveProperty("totalQuestions");
        expect(pillar).toHaveProperty("answeredQuestions");
      });
    });

    it("can find review by ID", () => {
      const review = reviews.find(
        (r) => r.id === "01932b3c-7d00-7000-8000-000000002001"
      );
      expect(review).toBeDefined();
      expect(review?.name).toBe("2026 Operational Readiness Review");
    });
  });
});

describe("Questions Data", () => {
  describe("questions data structure", () => {
    it("has valid question entries", () => {
      expect(questions.length).toBeGreaterThan(0);
    });

    it("questions have required fields", () => {
      const question = questions[0];
      expect(question).toHaveProperty("id");
      expect(question).toHaveProperty("pillar");
      expect(question).toHaveProperty("text");
      expect(question).toHaveProperty("type");
    });

    it("question type is valid", () => {
      questions.forEach((question) => {
        expect(["yes-no", "checklist"]).toContain(question.type);
      });
    });

    it("can filter questions by pillar", () => {
      const securityQuestions = questions.filter(
        (q) => q.pillar === "security"
      );
      expect(securityQuestions.length).toBeGreaterThan(0);
      securityQuestions.forEach((q) => {
        expect(q.pillar).toBe("security");
      });
    });

    it("can find question by ID", () => {
      const question = questions.find((q) => q.id === "sec-1");
      expect(question).toBeDefined();
      expect(question?.pillar).toBe("security");
    });

    it("questions have optional metadata fields", () => {
      const questionWithMetadata = questions.find((q) => q.importance);
      expect(questionWithMetadata).toBeDefined();
      if (questionWithMetadata) {
        expect(typeof questionWithMetadata.importance).toBe("string");
      }
    });
  });
});
