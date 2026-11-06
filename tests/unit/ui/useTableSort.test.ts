import { describe, it, expect } from "vitest";
import { ref } from "vue";
import { useSortState } from "~/composables/table/useSortState";

describe("useSortState", async () => {
  const mockItems = ref([
    { id: "1", name: "Charlie", status: "active", score: 85 },
    { id: "2", name: "Alice", status: "inactive", score: 92 },
    { id: "3", name: "Bob", status: "active", score: 78 },
  ]);

  describe("initial state", () => {
    it("should use default sort key 'name'", () => {
      const { sortBy } = useSortState(mockItems);
      expect(sortBy.value).toBe("name");
    });

    it("should use default direction 'asc'", () => {
      const { sortDirection } = useSortState(mockItems);
      expect(sortDirection.value).toBe("asc");
    });

    it("should accept custom default sort key", () => {
      const { sortBy } = useSortState(mockItems, "status");
      expect(sortBy.value).toBe("status");
    });

    it("should accept custom default direction", () => {
      const { sortDirection } = useSortState(mockItems, "name", "desc");
      expect(sortDirection.value).toBe("desc");
    });
  });

  describe("sortedItems", () => {
    it("should sort items ascending by default key", () => {
      const { sortedItems } = useSortState(mockItems);

      expect(sortedItems.value[0]?.name).toBe("Alice");
      expect(sortedItems.value[1]?.name).toBe("Bob");
      expect(sortedItems.value[2]?.name).toBe("Charlie");
    });

    it("should sort items descending when direction is desc", () => {
      const { sortedItems } = useSortState(mockItems, "name", "desc");

      expect(sortedItems.value[0]?.name).toBe("Charlie");
      expect(sortedItems.value[1]?.name).toBe("Bob");
      expect(sortedItems.value[2]?.name).toBe("Alice");
    });

    it("should sort by different key", () => {
      const { sortedItems } = useSortState(mockItems, "status", "asc");

      expect(sortedItems.value[0]?.status).toBe("active");
      expect(sortedItems.value[2]?.status).toBe("inactive");
    });

    it("should not mutate original array", () => {
      const items = ref([
        { id: "1", name: "B" },
        { id: "2", name: "A" },
      ]);
      const { sortedItems } = useSortState(items);

      expect(sortedItems.value[0]?.name).toBe("A");
      expect(items.value[0]?.name).toBe("B"); // Original unchanged
    });
  });

  describe("handleSort", () => {
    it("should change sort key when different key clicked", () => {
      const { handleSort, sortBy, sortDirection } = useSortState(mockItems);

      handleSort("status");

      expect(sortBy.value).toBe("status");
      expect(sortDirection.value).toBe("asc"); // Reset to asc
    });

    it("should toggle direction when same key clicked", () => {
      const { handleSort, sortDirection } = useSortState(mockItems);

      expect(sortDirection.value).toBe("asc");

      handleSort("name"); // Same key
      expect(sortDirection.value).toBe("desc");

      handleSort("name"); // Same key again
      expect(sortDirection.value).toBe("asc");
    });

    it("should reset to asc when switching to new key", () => {
      const { handleSort, sortDirection } = useSortState(mockItems);

      handleSort("name"); // Toggle to desc
      expect(sortDirection.value).toBe("desc");

      handleSort("status"); // New key
      expect(sortDirection.value).toBe("asc");
    });
  });

  describe("null/undefined handling", () => {
    it("should handle null values in sort", () => {
      const itemsWithNull = ref([
        { id: "1", name: "Bob" },
        { id: "2", name: null },
        { id: "3", name: "Alice" },
      ]);

      const { sortedItems } = useSortState(itemsWithNull);

      // Null should sort before other values in asc
      expect(sortedItems.value[0]?.name).toBeNull();
    });

    it("should handle undefined values in sort", () => {
      const itemsWithUndefined = ref([
        { id: "1", name: "Bob" },
        { id: "2" }, // name is undefined
        { id: "3", name: "Alice" },
      ]);

      const { sortedItems } = useSortState(itemsWithUndefined);

      // Undefined should sort before other values in asc
      expect(sortedItems.value[0]?.name).toBeUndefined();
    });

    it("should handle both null values", () => {
      const itemsBothNull = ref([
        { id: "1", name: null },
        { id: "2", name: null },
      ]);

      const { sortedItems } = useSortState(itemsBothNull);

      // Both null should maintain order (return 0)
      expect(sortedItems.value).toHaveLength(2);
    });
  });

  describe("reactive updates", () => {
    it("should update when source items change", () => {
      const items = ref([
        { id: "1", name: "Bob" },
        { id: "2", name: "Alice" },
      ]);

      const { sortedItems } = useSortState(items);
      expect(sortedItems.value[0]?.name).toBe("Alice");

      items.value.push({ id: "3", name: "Aaron" });

      expect(sortedItems.value[0]?.name).toBe("Aaron");
    });
  });

  describe("case insensitive sorting", () => {
    it("should sort case-insensitively", () => {
      const items = ref([
        { id: "1", name: "bob" },
        { id: "2", name: "Alice" },
        { id: "3", name: "CHARLIE" },
      ]);

      const { sortedItems } = useSortState(items);

      expect(sortedItems.value[0]?.name).toBe("Alice");
      expect(sortedItems.value[1]?.name).toBe("bob");
      expect(sortedItems.value[2]?.name).toBe("CHARLIE");
    });
  });
});
