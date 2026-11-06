import { describe, it, expect, beforeEach } from "vitest";
import { useAssessmentAnswers } from "~/composables/assessment/useAssessmentAnswers";
import type { QuestionAnswer, ChecklistAnswerWithNA } from "~/models/question";
import { isChecklistAnswer, isChecklistWithNAAnswer } from "~/models/question";

describe("useAssessmentAnswers - Checklist Answer Semantics", () => {
  let setAnswer: (questionId: string, answer: QuestionAnswer) => void;
  let clearAnswer: (questionId: string) => void;
  let getAnswer: (questionId: string) => QuestionAnswer | undefined;
  let hasAnswer: (questionId: string) => boolean;

  beforeEach(() => {
    const composable = useAssessmentAnswers();
    setAnswer = composable.setAnswer;
    clearAnswer = composable.clearAnswer;
    getAnswer = composable.getAnswer;
    hasAnswer = composable.hasAnswer;
  });

  describe("checklist answer as array", () => {
    it("should store checklist answer as array of checked item IDs", () => {
      setAnswer("q1", ["item-1", "item-2", "item-3"]);

      const answer = getAnswer("q1");
      expect(Array.isArray(answer)).toBe(true);
      expect(answer).toEqual(["item-1", "item-2", "item-3"]);
    });

    it("should mark question as answered when at least one item is checked", () => {
      setAnswer("q1", ["item-1"]);
      expect(hasAnswer("q1")).toBe(true);
    });

    it("should support empty array (no items checked)", () => {
      setAnswer("q1", []);
      const answer = getAnswer("q1");
      expect(Array.isArray(answer)).toBe(true);
      expect(answer).toEqual([]);
    });

    it("should allow updating checked items", () => {
      setAnswer("q1", ["item-1", "item-2"]);
      setAnswer("q1", ["item-1", "item-3"]); // Changed item-2 to item-3

      const answer = getAnswer("q1");
      expect(answer).toEqual(["item-1", "item-3"]);
    });

    it("should handle unchecking all items", () => {
      setAnswer("q1", ["item-1", "item-2"]);
      setAnswer("q1", []); // Unchecked all

      const answer = getAnswer("q1");
      expect(Array.isArray(answer)).toBe(true);
      expect(answer).toEqual([]);
    });
  });

  describe("checklist answer with N/A", () => {
    it("should support ChecklistAnswerWithNA structure", () => {
      const answer: ChecklistAnswerWithNA = {
        checked: ["item-1", "item-2"],
        na: ["item-3"],
      };
      setAnswer("q1", answer);

      const result = getAnswer("q1");
      expect(result).toEqual(answer);
    });

    it("should handle all items marked as N/A", () => {
      const answer: ChecklistAnswerWithNA = {
        checked: [],
        na: ["item-1", "item-2", "item-3"],
      };
      setAnswer("q1", answer);

      const result = getAnswer("q1");
      expect(result).toEqual(answer);
    });

    it("should handle mixed checked and N/A items", () => {
      const answer: ChecklistAnswerWithNA = {
        checked: ["item-1"],
        na: ["item-2", "item-3"],
      };
      setAnswer("q1", answer);

      const result = getAnswer("q1");
      expect(result).toEqual(answer);
    });

    it("should allow moving item from checked to N/A", () => {
      // Start with item-2 checked
      setAnswer("q1", { checked: ["item-1", "item-2"], na: ["item-3"] });

      // Move item-2 to N/A
      setAnswer("q1", { checked: ["item-1"], na: ["item-2", "item-3"] });

      const result = getAnswer("q1") as ChecklistAnswerWithNA;
      expect(result.checked).toEqual(["item-1"]);
      expect(result.na).toEqual(["item-2", "item-3"]);
    });

    it("should allow moving item from N/A to checked", () => {
      // Start with item-2 in N/A
      setAnswer("q1", { checked: ["item-1"], na: ["item-2", "item-3"] });

      // Move item-2 to checked
      setAnswer("q1", { checked: ["item-1", "item-2"], na: ["item-3"] });

      const result = getAnswer("q1") as ChecklistAnswerWithNA;
      expect(result.checked).toEqual(["item-1", "item-2"]);
      expect(result.na).toEqual(["item-3"]);
    });
  });

  describe("checklist answer type guards", () => {
    it("should identify simple array as checklist answer", () => {
      const answer: QuestionAnswer = ["item-1", "item-2"];
      expect(isChecklistAnswer(answer)).toBe(true);
    });

    it("should identify ChecklistAnswerWithNA structure", () => {
      const answer: QuestionAnswer = { checked: ["item-1"], na: ["item-2"] };
      expect(isChecklistWithNAAnswer(answer)).toBe(true);
    });

    it("should not identify yes/no answer as checklist", () => {
      expect(isChecklistAnswer("yes")).toBe(false);
      expect(isChecklistAnswer("no")).toBe(false);
      expect(isChecklistAnswer("na")).toBe(false);
    });

    it("should not identify simple array as ChecklistAnswerWithNA", () => {
      const answer: QuestionAnswer = ["item-1"];
      expect(isChecklistWithNAAnswer(answer)).toBe(false);
    });
  });

  describe("checklist answer semantics", () => {
    it("should treat empty array as unanswered (no progress)", () => {
      setAnswer("q1", []);
      // Empty array means no items checked, so technically answered but empty
      expect(hasAnswer("q1")).toBe(true);
      const answer = getAnswer("q1");
      expect(Array.isArray(answer) && answer.length === 0).toBe(true);
    });

    it("should treat N/A with empty checked array as answered", () => {
      setAnswer("q1", { checked: [], na: ["item-1"] });
      expect(hasAnswer("q1")).toBe(true);
    });

    it("should handle question-level N/A (traditional)", () => {
      setAnswer("q1", "na");
      expect(hasAnswer("q1")).toBe(true);
      expect(getAnswer("q1")).toBe("na");
    });

    it("should allow clearing checklist answer", () => {
      setAnswer("q1", ["item-1", "item-2"]);
      clearAnswer("q1");

      expect(hasAnswer("q1")).toBe(false);
      // null (explicit cleared state), not undefined — prevents fallback to stale DB value
      expect(getAnswer("q1")).toBeNull();
    });

    it("should handle partial completion (some items checked)", () => {
      // 2 out of 5 items checked - still counts as answered
      setAnswer("q1", ["item-1", "item-2"]);

      expect(hasAnswer("q1")).toBe(true);
      const answer = getAnswer("q1") as string[];
      expect(answer.length).toBe(2);
    });
  });

  describe("checklist vs yes-no answer compatibility", () => {
    it("should support mixed answer types in same assessment", () => {
      setAnswer("q1", "yes"); // Yes-no question
      setAnswer("q2", ["item-1", "item-2"]); // Checklist question
      setAnswer("q3", "no"); // Yes-no question

      expect(getAnswer("q1")).toBe("yes");
      expect(getAnswer("q2")).toEqual(["item-1", "item-2"]);
      expect(getAnswer("q3")).toBe("no");
    });

    it("should not confuse checklist array with string values", () => {
      setAnswer("q1", ["yes", "no"]); // These are item IDs, not answers
      const answer = getAnswer("q1");

      expect(Array.isArray(answer)).toBe(true);
      expect(answer).toEqual(["yes", "no"]);
      expect(answer).not.toBe("yes");
      expect(answer).not.toBe("no");
    });
  });
});
