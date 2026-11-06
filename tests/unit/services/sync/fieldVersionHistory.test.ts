import { describe, expect, it } from "vitest";
import {
  areJsonFieldValuesEqual,
  computePreviousValue,
  type LatestFieldVersionEvent,
} from "~/services/sync/inbound/helpers";

function latest(
  value: string | null,
  updatedAt: string,
  actorId = "actor_alice",
  previousValue: string | null = null
): LatestFieldVersionEvent {
  return { value, updatedAt, actorId, previousValue };
}

describe("field version history helpers", () => {
  it("should reset previousValue when the same actor edits after the 5s window", () => {
    const first = latest(
      JSON.stringify({ checked: ["a", "b"], na: [] }),
      "2026-06-01T10:00:00.000Z"
    );

    expect(
      computePreviousValue(
        first,
        JSON.stringify({ checked: [], na: [] }),
        "actor_alice",
        "2026-06-01T10:00:10.000Z"
      )
    ).toBe(first.value);
  });

  it("should carry the original previousValue for rapid same-actor edits", () => {
    expect(
      computePreviousValue(
        latest('"yes"', "2026-06-01T10:00:00.000Z"),
        '"no"',
        "actor_alice",
        "2026-06-01T10:00:03.000Z"
      )
    ).toBeNull();
  });

  it("should capture a fresh previousValue for cross-actor edits within 5s", () => {
    expect(
      computePreviousValue(
        latest('"yes"', "2026-06-01T10:00:00.000Z", "actor_alice"),
        '"no"',
        "actor_bob",
        "2026-06-01T10:00:01.000Z"
      )
    ).toBe('"yes"');
  });

  it("should compare JSON field values semantically instead of by string order", () => {
    expect(
      areJsonFieldValuesEqual(
        JSON.stringify({ checked: ["a", "b"], na: [] }),
        '{"na":[],"checked":["b","a"]}'
      )
    ).toBe(true);
  });
});
