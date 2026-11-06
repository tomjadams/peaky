import { describe, expect, it } from "vitest";
import { isQuestionComplete } from "~/services/review/questionCompletion";

const checklist = {
  type: "checklist" as const,
  checklistItems: [
    { id: "practice-1", order: 1, text: "Practice one" },
    { id: "practice-2", order: 2, text: "Practice two" },
  ],
};
const yesNo = { type: "yes-no" as const };

describe("isQuestionComplete", () => {
  it("distinguishes an explicit empty checklist from an unanswered checklist", () => {
    expect(isQuestionComplete(checklist, null)).toBe(false);
    expect(isQuestionComplete(checklist, { checked: [], na: [] })).toBe(true);
    expect(isQuestionComplete(checklist, [])).toBe(true);
  });

  it("counts every compatible checklist shape as an answer", () => {
    expect(
      isQuestionComplete(checklist, { checked: ["practice-1"], na: [] })
    ).toBe(true);
    expect(isQuestionComplete(checklist, "na")).toBe(true);
  });

  it("rejects type-incompatible shapes except whole-question N/A", () => {
    expect(isQuestionComplete(checklist, "yes")).toBe(false);
    expect(isQuestionComplete(checklist, "no")).toBe(false);
    expect(isQuestionComplete(yesNo, { checked: [], na: [] })).toBe(false);
    expect(isQuestionComplete(yesNo, "na")).toBe(true);
  });
});
