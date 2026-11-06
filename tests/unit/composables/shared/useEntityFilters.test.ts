import { beforeEach, expect, it } from "vitest";
import { useFilterState } from "~/composables/table/useFilterState";

interface Item {
  id: string;
  name: string;
  category: string;
}

const items: Item[] = [
  { id: "1", name: "Alpha Service", category: "backend" },
  { id: "2", name: "Beta Frontend", category: "frontend" },
  { id: "3", name: "Gamma API", category: "backend" },
];

function makeFilters() {
  return useFilterState<Item>({
    searchStateKey: `test-search-${Math.random()}`,
    searchFields: (item) => [item.name],
    filterFields: {
      category: {
        stateKey: `test-category-${Math.random()}`,
        defaultValue: "all",
        match: (item, value) => item.category === value,
      },
    },
  });
}

let filters: ReturnType<typeof makeFilters>;

beforeEach(() => {
  filters = makeFilters();
  filters.resetFilters();
});

it("initial state: filterItems returns all items when no filter is active", () => {
  const result = filters.filterItems(items);
  expect(result).toHaveLength(3);
});

it("initial state: searchQuery is empty", () => {
  expect(filters.searchQuery.value).toBe("");
});

it("search by name narrows filtered results correctly", () => {
  filters.searchQuery.value = "Alpha";
  const result = filters.filterItems(items);
  expect(result).toHaveLength(1);
  expect(result[0]!.id).toBe("1");
});

it("search is case-insensitive", () => {
  filters.searchQuery.value = "BETA";
  const result = filters.filterItems(items);
  expect(result).toHaveLength(1);
  expect(result[0]!.id).toBe("2");
});

it("filter field narrows results to matching category", () => {
  filters.filterStates["category"]!.value = "backend";
  const result = filters.filterItems(items);
  expect(result).toHaveLength(2);
  expect(result.every((i) => i.category === "backend")).toBe(true);
});

it("combined search and filter field narrows further", () => {
  filters.filterStates["category"]!.value = "backend";
  filters.searchQuery.value = "Gamma";
  const result = filters.filterItems(items);
  expect(result).toHaveLength(1);
  expect(result[0]!.id).toBe("3");
});

it("reset restores initial state: search cleared and filter set to default", () => {
  filters.searchQuery.value = "Alpha";
  filters.filterStates["category"]!.value = "backend";

  filters.resetFilters();

  expect(filters.searchQuery.value).toBe("");
  expect(filters.filterStates["category"]!.value).toBe("all");
  expect(filters.filterItems(items)).toHaveLength(3);
});

it("empty items array returns empty results without error", () => {
  filters.searchQuery.value = "Alpha";
  const result = filters.filterItems([]);
  expect(result).toHaveLength(0);
});

it("search with no matches returns empty array", () => {
  filters.searchQuery.value = "nonexistent-xyz";
  const result = filters.filterItems(items);
  expect(result).toHaveLength(0);
});
