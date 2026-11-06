import { describe, expect, it } from "vitest";
import { resolveSafeRedirect } from "../../../../../server/utils/auth/safe-redirect";

const ORIGIN = "https://peaky.example";

describe("resolveSafeRedirect", () => {
  it.each([
    undefined,
    "https://evil.example/teams",
    "//evil.example/teams",
    "/\\evil.example/teams",
    "javascript:alert(1)",
  ])("rejects unsafe target %s", (target) => {
    expect(resolveSafeRedirect(target, ORIGIN)).toBe("/teams");
  });

  it("keeps a same-origin path with its query and hash", () => {
    expect(resolveSafeRedirect("/reviews/1?mode=survey#question", ORIGIN)).toBe(
      "/reviews/1?mode=survey#question"
    );
  });
});
