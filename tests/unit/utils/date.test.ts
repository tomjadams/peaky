import { describe, expect, it } from "vitest";
import { formatCompactDuration } from "~/utils/date";

describe("formatCompactDuration", () => {
  it.each([
    [1_000, "1s"],
    [59_000, "59s"],
    [60_000, "1m"],
    [3_600_000, "1h"],
    [86_400_000, "1d"],
  ])("formats %i milliseconds as %s", (durationMs, expected) => {
    expect(formatCompactDuration(durationMs)).toBe(expected);
  });
});
