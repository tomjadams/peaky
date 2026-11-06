import { describe, it, expect, beforeEach } from "vitest";
import { useAssessmentAnswers } from "~/composables/assessment/useAssessmentAnswers";
import type { QuestionAnswer } from "~/models/question";

describe("useAssessmentAnswers", () => {
  let answers: Ref<Record<string, QuestionAnswer>>;
  let setAnswer: (questionId: string, answer: QuestionAnswer) => void;
  let clearAnswer: (questionId: string) => void;
  let getAnswer: (questionId: string) => QuestionAnswer | undefined;
  let hasAnswer: (questionId: string) => boolean;

  beforeEach(() => {
    const composable = useAssessmentAnswers();
    answers = composable.answers;
    setAnswer = composable.setAnswer;
    clearAnswer = composable.clearAnswer;
    getAnswer = composable.getAnswer;
    hasAnswer = composable.hasAnswer;
    // No manual reset needed — useAssessmentAnswers() creates a fresh ref({}) each call.
  });

  describe("setAnswer", () => {
    it("should set an answer", () => {
      setAnswer("q1", "yes");
      expect(answers.value.q1).toBe("yes");
    });

    it("should overwrite existing answer", () => {
      setAnswer("q1", "yes");
      setAnswer("q1", "no");
      expect(answers.value.q1).toBe("no");
    });
  });

  describe("clearAnswer", () => {
    it("should clear an answer to null (explicit cleared state)", () => {
      setAnswer("q1", "yes");
      clearAnswer("q1");
      // null (not undefined) so the computed in useAssessment doesn't fall
      // back to the stale q.answer from the last DB fetch.
      expect(answers.value.q1).toBeNull();
      expect(getAnswer("q1")).toBeNull();
    });

    it("should set non-existent answer to null when cleared", () => {
      clearAnswer("non-existent");
      expect(answers.value["non-existent"]).toBeNull();
    });
  });

  describe("getAnswer", () => {
    it("should get an answer", () => {
      setAnswer("q1", "yes");
      expect(getAnswer("q1")).toBe("yes");
    });

    it("should return undefined for missing answer", () => {
      expect(getAnswer("missing")).toBeUndefined();
    });
  });

  describe("hasAnswer", () => {
    it("should return true for answered question", () => {
      setAnswer("q1", "yes");
      expect(hasAnswer("q1")).toBe(true);
    });

    it("should return false for unanswered question", () => {
      expect(hasAnswer("missing")).toBe(false);
    });
  });
});
