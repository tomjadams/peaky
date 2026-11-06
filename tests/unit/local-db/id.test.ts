import { describe, expect, it } from "vitest";
import { createUuidV7 } from "../../../shared/id";

describe("shared ID utilities", () => {
  it("creates canonical UUIDv7 identifiers", () => {
    expect(createUuidV7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("creates unique identifiers on each call", () => {
    const id1 = createUuidV7();
    const id2 = createUuidV7();

    expect(id1).not.toBe(id2);
  });

  it("creates time-ordered identifiers", () => {
    const id1 = createUuidV7();
    const id2 = createUuidV7();

    // UUIDv7 encodes timestamp in the leading bytes, so lexicographic order
    // reflects creation order (within the same millisecond they may be equal)
    expect(id1 <= id2).toBe(true);
  });
});
