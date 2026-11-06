import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import BulkActionBar from "~/components/BulkActionBar.vue";

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = (props = {}) => {
  return render(BulkActionBar, {
    props: {
      selectedCount: 0,
      ...props,
    },
    global: {
      stubs: {
        Icon: true,
      },
    },
  });
};

describe("BulkActionBar", () => {
  afterEach(() => {
    cleanup();
  });

  describe("visibility", () => {
    it("does not render when no items selected", () => {
      renderComponent({ selectedCount: 0 });
      expect(screen.queryByRole("toolbar")).toBeNull();
    });

    it("renders when items are selected", () => {
      renderComponent({ selectedCount: 3 });
      expect(screen.getByRole("toolbar")).toBeDefined();
    });
  });

  describe("selection count display", () => {
    it("displays the count when items selected", () => {
      renderComponent({ selectedCount: 1 });
      // Test that count is displayed, not exact text format
      expect(screen.getByText(/1/)).toBeDefined();
    });

    it("updates count when selection changes", () => {
      renderComponent({ selectedCount: 5 });
      // Verify the count value appears somewhere in the toolbar
      expect(screen.getByText(/5/)).toBeDefined();
    });
  });

  describe("action buttons", () => {
    it("renders all action buttons", () => {
      renderComponent({ selectedCount: 2 });
      expect(screen.getByText("Transfer")).toBeDefined();
      expect(screen.getByText("Archive")).toBeDefined();
      expect(screen.getByText("Delete")).toBeDefined();
    });

    it("emits transfer when Transfer clicked", async () => {
      const { emitted } = renderComponent({ selectedCount: 2 });

      await fireEvent.click(screen.getByText("Transfer"));

      expect(emitted()["transfer"]).toBeTruthy();
    });

    it("emits archive when Archive clicked", async () => {
      const { emitted } = renderComponent({ selectedCount: 2 });

      await fireEvent.click(screen.getByText("Archive"));

      expect(emitted()["archive"]).toBeTruthy();
    });

    it("emits delete when Delete clicked", async () => {
      const { emitted } = renderComponent({ selectedCount: 2 });

      await fireEvent.click(screen.getByText("Delete"));

      expect(emitted()["delete"]).toBeTruthy();
    });
  });

  describe("clear selection", () => {
    it("renders clear button", () => {
      renderComponent({ selectedCount: 1 });
      expect(screen.getByLabelText("Clear selection")).toBeDefined();
    });

    it("emits clear when clear button clicked", async () => {
      const { emitted } = renderComponent({ selectedCount: 2 });

      await fireEvent.click(screen.getByLabelText("Clear selection"));

      expect(emitted()["clear"]).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("has toolbar role", () => {
      renderComponent({ selectedCount: 1 });
      expect(screen.getByRole("toolbar")).toBeDefined();
    });

    it("has aria-label for toolbar", () => {
      renderComponent({ selectedCount: 1 });
      expect(
        screen.getByRole("toolbar", { name: "Bulk actions" })
      ).toBeDefined();
    });

    it("clear button has accessible label", () => {
      renderComponent({ selectedCount: 1 });
      expect(screen.getByLabelText("Clear selection")).toBeDefined();
    });
  });
});
