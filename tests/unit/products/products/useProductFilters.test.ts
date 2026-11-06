import { beforeEach, describe, expect, it } from "vitest";
import type { Product } from "~/models";
import { useProductFilters } from "~/composables/products/useProductFilters";

describe("useProductFilters", () => {
  const mockProducts: Product[] = [
    {
      id: "product-001",
      name: "Customer Portal API",
      origin: "bespoke",
      isExternal: true,
      productManagerId: "vlads",
      teamIds: ["checkout-core"],
      componentIds: [],
      createdAt: "2026-02-20T00:00:00Z",
      createdBy: "user-001",
      totalReviewCount: 2,
      activeReviewCount: 1,
      lastActivityDate: "2026-02-20T00:00:00Z",
    },
    {
      id: "product-002",
      name: "Shared Components",
      origin: "open-source",
      isExternal: false,
      productManagerId: "heitorl",
      teamIds: ["infrastructure"],
      componentIds: [],
      createdAt: "2026-02-12T00:00:00Z",
      createdBy: "user-002",
      totalReviewCount: 1,
      activeReviewCount: 0,
      lastActivityDate: "2026-02-14T00:00:00Z",
    },
    {
      id: "product-003",
      name: "Build Tools",
      origin: "vendor",
      isExternal: false,
      productManagerId: "sarahc",
      teamIds: ["developer-experience"],
      componentIds: [],
      createdAt: "2026-02-10T00:00:00Z",
      createdBy: "user-003",
      totalReviewCount: 0,
      activeReviewCount: 0,
      lastActivityDate: "2026-02-10T00:00:00Z",
    },
  ];

  let filterProducts: ReturnType<typeof useProductFilters>["filterProducts"];
  let searchQuery: ReturnType<typeof useProductFilters>["searchQuery"];
  let originFilter: ReturnType<typeof useProductFilters>["originFilter"];
  let resetFilters: ReturnType<typeof useProductFilters>["resetFilters"];

  beforeEach(() => {
    const composable = useProductFilters();
    filterProducts = composable.filterProducts;
    searchQuery = composable.searchQuery;
    originFilter = composable.originFilter;
    resetFilters = composable.resetFilters;
    resetFilters();
  });

  it("returns all products with no filters", () => {
    expect(filterProducts(mockProducts)).toHaveLength(3);
  });

  it("filters by origin", () => {
    originFilter.value = "open-source";
    const result = filterProducts(mockProducts);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("product-002");
  });

  it("filters by search query on product name", () => {
    searchQuery.value = "api";
    const result = filterProducts(mockProducts);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("product-001");
  });

  it("search is case-insensitive", () => {
    searchQuery.value = "BUILD";
    const result = filterProducts(mockProducts);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("product-003");
  });

  it("combines origin and search filters", () => {
    originFilter.value = "bespoke";
    searchQuery.value = "customer";
    const result = filterProducts(mockProducts);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("product-001");
  });

  it("returns empty array when no matches", () => {
    searchQuery.value = "nonexistent";
    const result = filterProducts(mockProducts);
    expect(result).toHaveLength(0);
  });

  it("resets filters", () => {
    searchQuery.value = "portal";
    originFilter.value = "bespoke";

    resetFilters();

    expect(searchQuery.value).toBe("");
    expect(originFilter.value).toBe("all");
  });
});
