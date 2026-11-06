import { describe, expect, it } from "vitest";
import { getCatalogDirectoryMirrorSnapshot } from "../../../server/data/catalog-directory-mirror";

describe("catalog directory snapshot", () => {
  it("includes bundled directory users beyond the fallback subset", () => {
    const snapshot = getCatalogDirectoryMirrorSnapshot();

    expect(snapshot.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "juliano",
          displayName: "Juliano Martinez",
        }),
        expect.objectContaining({
          id: "stijn",
          displayName: "Stijn de Reede",
        }),
      ])
    );
  });
});
