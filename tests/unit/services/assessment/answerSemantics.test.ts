import { describe, expect, it } from "vitest";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";

const checklist = {
  type: "checklist" as const,
  practiceIds: ["practice-1", "practice-2"],
};
const yesNo = { type: "yes-no" as const, practiceIds: [] };

describe("normalizeQuestionAnswer", () => {
  it("preserves compatible scalar and checklist answers", () => {
    expect(normalizeQuestionAnswer(yesNo, "yes")).toBe("yes");
    expect(
      normalizeQuestionAnswer(checklist, {
        checked: ["practice-1"],
        na: ["practice-2"],
      })
    ).toEqual({ checked: ["practice-1"], na: ["practice-2"] });
    expect(normalizeQuestionAnswer(checklist, [])).toEqual({
      checked: [],
      na: [],
    });
  });

  it("keeps whole-question N/A valid for either question type", () => {
    expect(normalizeQuestionAnswer(yesNo, "na")).toBe("na");
    expect(normalizeQuestionAnswer(checklist, "na")).toBe("na");
  });

  it("treats type-incompatible answer shapes as unanswered", () => {
    expect(normalizeQuestionAnswer(checklist, "yes")).toBeNull();
    expect(normalizeQuestionAnswer(checklist, "no")).toBeNull();
    expect(normalizeQuestionAnswer(yesNo, { checked: [], na: [] })).toBeNull();
    expect(normalizeQuestionAnswer(yesNo, ["practice-1"])).toBeNull();
  });

  it("removes deleted practice IDs without dropping a compatible answer", () => {
    expect(
      normalizeQuestionAnswer(checklist, {
        checked: ["practice-1", "practice-removed"],
        na: ["practice-2", "practice-removed"],
      })
    ).toEqual({ checked: ["practice-1"], na: ["practice-2"] });
  });

  it("rejects malformed checklist objects instead of inventing an empty answer", () => {
    expect(
      normalizeQuestionAnswer(checklist, { checked: [], na: "practice-1" })
    ).toBeNull();
    expect(normalizeQuestionAnswer(checklist, {})).toBeNull();
  });
});
