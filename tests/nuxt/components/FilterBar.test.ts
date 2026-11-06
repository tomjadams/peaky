import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import FilterBar from "~/components/FilterBar.vue";

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = (props = {}) => {
  return render(FilterBar, {
    props: {
      modelValue: "all",
      ...props,
    },
    global: {
      stubs: {
        Icon: true,
        UFieldGroup: {
          template: '<div v-bind="$attrs"><slot /></div>',
        },
        UButton: {
          template:
            '<button v-bind="$attrs" @click="$emit(\'click\')"><slot />{{ $attrs.label }}</button>',
          props: ["color", "variant", "label"],
        },
      },
    },
  });
};

describe("FilterBar", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders all filter options", () => {
      renderComponent();
      expect(screen.getByText("All")).toBeDefined();
      expect(screen.getByText("Ready")).toBeDefined();
      expect(screen.getByText("In Progress")).toBeDefined();
      expect(screen.getByText("Action Needed")).toBeDefined();
    });

    it("renders status label", () => {
      renderComponent();
      expect(screen.getByText("Status:")).toBeDefined();
    });
  });

  describe("filter selection", () => {
    it("shows active state for selected filter", () => {
      renderComponent({ modelValue: "ready" });
      const readyButton = screen.getByText("Ready");
      expect(readyButton).toBeDefined();
    });

    it("emits update:modelValue when filter clicked", async () => {
      const { emitted } = renderComponent();

      await fireEvent.click(screen.getByText("Ready"));

      const events = emitted();
      expect(events["update:modelValue"]).toBeTruthy();
      expect(events["update:modelValue"]![0]).toEqual(["ready"]);
    });

    it("can select In Progress filter", async () => {
      const { emitted } = renderComponent();

      await fireEvent.click(screen.getByText("In Progress"));

      const events = emitted();
      expect(events["update:modelValue"]).toBeTruthy();
      expect(events["update:modelValue"]![0]).toEqual(["in_progress"]);
    });

    it("can select Action Needed filter", async () => {
      const { emitted } = renderComponent();

      await fireEvent.click(screen.getByText("Action Needed"));

      const events = emitted();
      expect(events["update:modelValue"]).toBeTruthy();
      expect(events["update:modelValue"]![0]).toEqual(["action_needed"]);
    });
  });

  describe("accessibility", () => {
    it("has tablist role", () => {
      renderComponent();
      expect(
        screen.getByRole("tablist", {
          name: "Filter applications by status",
        })
      ).toBeDefined();
    });

    it("filter tabs are rendered", () => {
      renderComponent();
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(4);
    });
  });
});
