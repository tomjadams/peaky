import { describe, it, expect } from "vitest";
import { useAssessment } from "~/composables/assessment/useAssessment";

describe("useAssessment", () => {
  it("should return default values when no review data", () => {
    const assessment = useAssessment("nonexistent");
    expect(assessment.overallProgress.value).toBe(0);
    expect(assessment.answeredCount.value).toBe(0);
    expect(assessment.totalQuestionCount.value).toBe(0);
    expect(assessment.isComplete()).toBe(false);
    expect(assessment.pillars.value).toEqual([]);
    expect(assessment.questions.value).toEqual([]);
  });

  describe("checklist question handling", () => {
    it("should handle checklist answers as array", () => {
      const assessment = useAssessment("review-1");

      assessment.setAnswer("checklist-q1", ["item-1", "item-2"]);

      const answer = assessment.getAnswer("checklist-q1");
      expect(Array.isArray(answer)).toBe(true);
      expect(answer).toEqual(["item-1", "item-2"]);
    });

    it("should handle checklist with N/A items", () => {
      const assessment = useAssessment("review-1");

      const checklistAnswer = {
        checked: ["item-1"],
        na: ["item-2", "item-3"],
      };
      assessment.setAnswer("checklist-q1", checklistAnswer);

      const answer = assessment.getAnswer("checklist-q1");
      expect(answer).toEqual(checklistAnswer);
    });

    it("should handle per-item N/A reasons", () => {
      const assessment = useAssessment("review-1");

      const reason = { reason: "not-in-scope" as const, comment: "Test" };
      assessment.handleItemNAConfirm("checklist-q1", "item-1", reason);

      // Should update itemNAReasons
      expect(
        assessment.itemNAReasons.value["checklist-q1"]?.["item-1"]
      ).toEqual(reason);

      // Should update answer to include item in N/A list
      const answer = assessment.getAnswer("checklist-q1");
      expect(answer).toHaveProperty("na");
      if (answer && typeof answer === "object" && "na" in answer) {
        expect(answer.na).toContain("item-1");
      }
    });

    it("should clear per-item N/A", () => {
      const assessment = useAssessment("review-1");

      // Set N/A first
      const reason = { reason: "not-in-scope" as const };
      assessment.handleItemNAConfirm("checklist-q1", "item-1", reason);

      // Clear N/A
      assessment.handleItemNAClear("checklist-q1", "item-1");

      expect(
        assessment.itemNAReasons.value["checklist-q1"]?.["item-1"]
      ).toBeUndefined();
      expect(assessment.getAnswer("checklist-q1")).toEqual({
        checked: [],
        na: [],
      });
    });

    it("should handle mixed yes-no and checklist answers", () => {
      const assessment = useAssessment("review-1");

      assessment.setAnswer("yes-no-q1", "yes");
      assessment.setAnswer("checklist-q1", ["item-1", "item-2"]);
      assessment.setAnswer("yes-no-q2", "no");

      expect(assessment.getAnswer("yes-no-q1")).toBe("yes");
      expect(assessment.getAnswer("checklist-q1")).toEqual([
        "item-1",
        "item-2",
      ]);
      expect(assessment.getAnswer("yes-no-q2")).toBe("no");
    });
  });
});
