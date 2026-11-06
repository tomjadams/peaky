import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import DataTable from "~/components/DataTable.vue";

describe("DataTable", () => {
  afterEach(() => {
    cleanup();
  });

  const mockColumns = [
    { key: "name", label: "Name", sortable: true },
    { key: "status", label: "Status", type: "status" as const },
    { key: "progress", label: "Progress", type: "progress" as const },
  ];

  const mockData = [
    { id: "1", name: "App One", status: "ready", progress: 75 },
    { id: "2", name: "App Two", status: "in_progress", progress: 50 },
  ];

  const renderComponent = (props = {}, slots = {}) => {
    return render(DataTable, {
      props: {
        columns: mockColumns,
        data: mockData,
        ...props,
      },
      slots,
      global: {
        stubs: {
          Icon: true,
          UCheckbox: {
            template:
              '<input type="checkbox" :checked="modelValue" :aria-label="ariaLabel" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
            props: ["modelValue", "ariaLabel", "indeterminate"],
          },
        },
      },
    });
  };

  describe("rendering", () => {
    it("renders column headers", () => {
      renderComponent();
      expect(screen.getByText("Name")).toBeDefined();
      expect(screen.getByText("Status")).toBeDefined();
      expect(screen.getByText("Progress")).toBeDefined();
    });

    it("renders data rows", () => {
      renderComponent();
      expect(screen.getByText("App One")).toBeDefined();
      expect(screen.getByText("App Two")).toBeDefined();
    });

    it("renders table with proper role", () => {
      renderComponent();
      expect(screen.getByRole("table")).toBeDefined();
    });

    it("uses the shared table surface class", () => {
      const { container } = renderComponent();
      expect(container.firstElementChild?.classList).toContain(
        "data-table-surface"
      );
    });

    it("uses custom aria-label when provided", () => {
      renderComponent({ ariaLabel: "Application list" });
      const table = screen.getByRole("table");
      expect(table).toBeDefined();
      expect(table.closest("[aria-label='Application list']")).toBeDefined();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no data", () => {
      renderComponent({ data: [] });
      expect(screen.getByText("No data available")).toBeDefined();
    });

    it("shows custom empty message", () => {
      renderComponent({ data: [], emptyMessage: "No applications found" });
      expect(screen.getByText("No applications found")).toBeDefined();
    });
  });

  describe("selection", () => {
    it("shows checkboxes when selectable", () => {
      renderComponent({ selectable: true, selectedIds: new Set() });
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("does not show checkboxes when not selectable", () => {
      renderComponent({ selectable: false });
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("emits toggle-all when header checkbox clicked", async () => {
      const { emitted } = renderComponent({
        selectable: true,
        selectedIds: new Set(),
      });

      const selectAllCheckbox = screen.getByLabelText("Select all rows");
      await fireEvent.click(selectAllCheckbox);

      expect(emitted()["toggle-all"]).toBeTruthy();
    });

    it("emits toggle-selection when row checkbox clicked", async () => {
      const { emitted } = renderComponent({
        selectable: true,
        selectedIds: new Set(),
      });

      const rowCheckboxes = screen.getAllByLabelText(/Select row/);
      await fireEvent.click(rowCheckboxes[0]!);

      const events = emitted();
      expect(events["toggle-selection"]).toBeTruthy();
      expect(events["toggle-selection"]![0]).toEqual(["1"]);
    });

    it("shows checked state for selected rows", () => {
      renderComponent({
        selectable: true,
        selectedIds: new Set(["1"]),
      });

      const rowCheckboxes = screen.getAllByLabelText(
        /Select row/
      ) as HTMLInputElement[];
      expect(rowCheckboxes[0]?.checked).toBe(true);
      expect(rowCheckboxes[1]?.checked).toBe(false);
    });
  });

  describe("sorting", () => {
    it("emits sort event when sortable column clicked", async () => {
      const { emitted } = renderComponent({
        sortBy: "name",
        sortDirection: "asc",
      });

      await fireEvent.click(screen.getByText("Name"));

      const sortEvents = emitted();
      expect(sortEvents["sort"]).toBeTruthy();
      expect(sortEvents["sort"]![0]).toEqual(["name"]);
    });

    it("does not emit sort for non-sortable columns", async () => {
      const columns = [{ key: "name", label: "Name", sortable: false }];
      const { emitted } = renderComponent({ columns });

      await fireEvent.click(screen.getByText("Name"));

      expect(emitted()["sort"]).toBeFalsy();
    });
  });

  describe("row clicks", () => {
    it("emits row-click when clickableRows enabled", async () => {
      const { emitted } = renderComponent({ clickableRows: true });

      const rows = document.querySelectorAll("tbody tr");
      await fireEvent.click(rows[0]!);

      const rowClickEvents = emitted();
      expect(rowClickEvents["row-click"]).toBeTruthy();
      const firstEvent = (rowClickEvents["row-click"] as unknown[][])[0]!;
      expect(firstEvent[0]).toEqual(mockData[0]);
    });

    it("does not emit row-click when clickableRows disabled", async () => {
      const { emitted } = renderComponent({ clickableRows: false });

      const rows = document.querySelectorAll("tbody tr");
      await fireEvent.click(rows[0]!);

      expect(emitted()["row-click"]).toBeFalsy();
    });

    it("handles keyboard navigation for clickable rows", async () => {
      const { emitted } = renderComponent({ clickableRows: true });

      const rows = document.querySelectorAll("tbody tr");
      await fireEvent.keyDown(rows[0]!, { key: "Enter" });

      expect(emitted()["row-click"]).toBeTruthy();
    });

    it("does not emit row-click from interactive content", async () => {
      const { emitted } = renderComponent(
        { clickableRows: true },
        { "cell-name": '<button type="button">Open menu</button>' }
      );

      await fireEvent.click(
        screen.getAllByRole("button", { name: "Open menu" })[0]!
      );

      expect(emitted()["row-click"]).toBeFalsy();
    });
  });

  describe("accessibility", () => {
    it("has proper table structure", () => {
      renderComponent();
      expect(document.querySelector("thead")).toBeDefined();
      expect(document.querySelector("tbody")).toBeDefined();
    });

    it("select all checkbox has aria-label", () => {
      renderComponent({ selectable: true, selectedIds: new Set() });
      expect(screen.getByLabelText("Select all rows")).toBeDefined();
    });
  });
});
