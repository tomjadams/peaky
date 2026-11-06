import { describe, expect, it } from "vitest";
import { nextColorMode, resolveColorMode } from "~/utils/colorMode";

describe("color mode resolution", () => {
  it("treats a missing fresh preference as the light product default", () => {
    expect(resolveColorMode(undefined)).toBe("light");
    expect(nextColorMode(undefined)).toBe("dark");
  });

  it("toggles from the applied mode", () => {
    expect(nextColorMode("light")).toBe("dark");
    expect(nextColorMode("dark")).toBe("light");
  });
});
