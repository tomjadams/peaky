import { describe, expect, it } from "vitest";
import { getCatalogDirectoryMirrorSnapshot } from "../../../server/data/catalog-directory-mirror";

describe("catalog directory mirror snapshot", () => {
  it("exposes the seeded teams as directory groups", () => {
    const snapshot = getCatalogDirectoryMirrorSnapshot();

    expect(snapshot.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "payments-scalability",
          displayName: "Payments Scalability",
        }),
      ])
    );
  });

  it("maps applications back to owning teams for local lookup flows", () => {
    const snapshot = getCatalogDirectoryMirrorSnapshot();

    expect(snapshot.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "modificationqueueprocessor",
          displayName: "ModificationQueueProcessor",
          ownerGroupId: "payments-scalability",
          ownerGroupName: "Payments Scalability",
        }),
      ])
    );
  });

  it("builds directory users from the current seeded people data", () => {
    const snapshot = getCatalogDirectoryMirrorSnapshot();

    expect(snapshot.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "heitorl", displayName: "Heitor Lessa" }),
        expect.objectContaining({ id: "vlads", displayName: "Vlad Skuba" }),
        expect.objectContaining({ id: "vladk", displayName: "Vlad Kostiuk" }),
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
