import { describe, expect, it } from "vitest";
import { formatQuestionReference } from "~/utils/questionReference";

describe("formatQuestionReference", () => {
  it("uses the pillar prefix and ordered question number instead of its storage ID", () => {
    expect(formatQuestionReference("reliability-resilience", "0001")).toBe(
      "REL-1"
    );
  });

  it("supports double-digit question positions", () => {
    expect(formatQuestionReference("operational-ownership", "0010")).toBe(
      "OPE-10"
    );
  });
});
