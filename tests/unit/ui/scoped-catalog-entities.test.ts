import { describe, expect, it } from "vitest";
import { filterScopedCatalogEntities } from "../../../app/catalog-directory-mirror/scoped-entities";

const items = [
  { id: "app-001", displayName: "Customer Portal" },
  { id: "app-002", displayName: "Payment Gateway" },
  { id: "app-003", displayName: "Analytics Dashboard" },
];

describe("filterScopedCatalogEntities", () => {
  it("shows preferred entities by default when no query is present", () => {
    expect(
      filterScopedCatalogEntities({
        items,
        preferredIds: ["app-001"],
        query: "",
      })
    ).toEqual([{ id: "app-001", displayName: "Customer Portal" }]);
  });

  it("widens the search to all entities once the user types a query", () => {
    expect(
      filterScopedCatalogEntities({
        items,
        preferredIds: ["app-001"],
        query: "payment",
      })
    ).toEqual([{ id: "app-002", displayName: "Payment Gateway" }]);
  });

  it("excludes already-selected entities from the result list", () => {
    expect(
      filterScopedCatalogEntities({
        items,
        query: "",
        selectedIds: ["app-001"],
      })
    ).toEqual([
      { id: "app-002", displayName: "Payment Gateway" },
      { id: "app-003", displayName: "Analytics Dashboard" },
    ]);
  });
});
