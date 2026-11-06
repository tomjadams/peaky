import { describe, it, expect } from "vitest";
import { useBulkSelection } from "~/ui/useBulkSelection";

describe("useBulkSelection", async () => {
  // Note: Each call to useBulkSelection creates fresh state
  // because the refs are defined inside the function

  describe("initial state", () => {
    it("should start with empty selection", () => {
      const { selectedIds, selectedCount } = useBulkSelection();
      expect(selectedIds.value.size).toBe(0);
      expect(selectedCount.value).toBe(0);
    });

    it("should return empty array for selectedApplicationIds", () => {
      const { selectedApplicationIds } = useBulkSelection();
      expect(selectedApplicationIds.value).toEqual([]);
    });
  });

  describe("toggleSelection", () => {
    it("should add item to selection", () => {
      const { toggleSelection, isSelected, selectedCount } = useBulkSelection();

      toggleSelection("app-1");

      expect(isSelected("app-1")).toBe(true);
      expect(selectedCount.value).toBe(1);
    });

    it("should remove item from selection if already selected", () => {
      const { toggleSelection, isSelected, selectedCount } = useBulkSelection();

      toggleSelection("app-1");
      toggleSelection("app-1");

      expect(isSelected("app-1")).toBe(false);
      expect(selectedCount.value).toBe(0);
    });

    it("should handle multiple selections", () => {
      const { toggleSelection, isSelected, selectedCount } = useBulkSelection();

      toggleSelection("app-1");
      toggleSelection("app-2");
      toggleSelection("app-3");

      expect(isSelected("app-1")).toBe(true);
      expect(isSelected("app-2")).toBe(true);
      expect(isSelected("app-3")).toBe(true);
      expect(selectedCount.value).toBe(3);
    });
  });

  describe("toggleAll", () => {
    const mockApplications = [
      {
        id: "app-1",
        name: "App 1",
        status: "ready" as const,
        owner: "user1",
        lastUpdated: "2024-01-01",
        progress: 50,
      },
      {
        id: "app-2",
        name: "App 2",
        status: "in_progress" as const,
        owner: "user2",
        lastUpdated: "2024-01-02",
        progress: 75,
      },
      {
        id: "app-3",
        name: "App 3",
        status: "action_needed" as const,
        owner: "user3",
        lastUpdated: "2024-01-03",
        progress: 25,
      },
    ];

    it("should select all when none selected", () => {
      const { toggleAll, selectedCount, isSelected } = useBulkSelection();

      toggleAll(mockApplications);

      expect(selectedCount.value).toBe(3);
      expect(isSelected("app-1")).toBe(true);
      expect(isSelected("app-2")).toBe(true);
      expect(isSelected("app-3")).toBe(true);
    });

    it("should deselect all when all selected", () => {
      const { toggleAll, selectedCount } = useBulkSelection();

      toggleAll(mockApplications); // Select all
      toggleAll(mockApplications); // Deselect all

      expect(selectedCount.value).toBe(0);
    });

    it("should select all when some selected", () => {
      const { toggleSelection, toggleAll, selectedCount } = useBulkSelection();

      toggleSelection("app-1"); // Select one
      toggleAll(mockApplications); // Should select all (not toggle to none)

      expect(selectedCount.value).toBe(3);
    });
  });

  describe("isSelected", () => {
    it("should return false for unselected items", () => {
      const { isSelected } = useBulkSelection();
      expect(isSelected("non-existent")).toBe(false);
    });

    it("should return true for selected items", () => {
      const { toggleSelection, isSelected } = useBulkSelection();

      toggleSelection("app-1");

      expect(isSelected("app-1")).toBe(true);
      expect(isSelected("app-2")).toBe(false);
    });
  });

  describe("clearSelection", () => {
    it("should clear all selections", () => {
      const { toggleSelection, clearSelection, selectedCount, isSelected } =
        useBulkSelection();

      toggleSelection("app-1");
      toggleSelection("app-2");
      expect(selectedCount.value).toBe(2);

      clearSelection();

      expect(selectedCount.value).toBe(0);
      expect(isSelected("app-1")).toBe(false);
      expect(isSelected("app-2")).toBe(false);
    });
  });

  describe("selectedApplicationIds", () => {
    it("should return array of selected IDs", () => {
      const { toggleSelection, selectedApplicationIds } = useBulkSelection();

      toggleSelection("app-1");
      toggleSelection("app-3");

      expect(selectedApplicationIds.value).toContain("app-1");
      expect(selectedApplicationIds.value).toContain("app-3");
      expect(selectedApplicationIds.value).toHaveLength(2);
    });

    it("should update reactively", () => {
      const { toggleSelection, selectedApplicationIds } = useBulkSelection();

      expect(selectedApplicationIds.value).toHaveLength(0);

      toggleSelection("app-1");
      expect(selectedApplicationIds.value).toHaveLength(1);

      toggleSelection("app-2");
      expect(selectedApplicationIds.value).toHaveLength(2);

      toggleSelection("app-1");
      expect(selectedApplicationIds.value).toHaveLength(1);
    });
  });
});
